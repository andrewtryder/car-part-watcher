import {
  CarPartSearchError,
  type CarPartSearchResult,
  type SearchExecutionOptions,
} from "../types.ts";
import type { Watch } from "../repositories/watch_repository.ts";

export function isRetryableError(error: unknown): boolean {
  if (error instanceof CarPartSearchError) {
    return error.code !== "REFINEMENT_REQUIRED" &&
      error.code !== "REFINEMENT_OPTION_NOT_FOUND" &&
      error.code !== "RUN_CANCELLED";
  }
  return true;
}

function cancellationError(signal: AbortSignal): CarPartSearchError {
  return signal.reason instanceof CarPartSearchError
    ? signal.reason
    : new CarPartSearchError("RUN_CANCELLED", "Search run was cancelled");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw cancellationError(signal);
}

function combineSignals(signals: (AbortSignal | undefined)[]) {
  const controller = new AbortController();
  const listeners = new Map<AbortSignal, () => void>();
  const abort = (signal: AbortSignal) => controller.abort(signal.reason);

  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      abort(signal);
      break;
    }
    const listener = () => abort(signal);
    listeners.set(signal, listener);
    signal.addEventListener("abort", listener, { once: true });
  }

  return {
    signal: controller.signal,
    dispose() {
      for (const [signal, listener] of listeners) {
        signal.removeEventListener("abort", listener);
      }
    },
  };
}

function waitForDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(cancellationError(signal));
    const timer = setTimeout(done, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(cancellationError(signal!));
    };
    function done() {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function executeSearchWithRetry(
  search: (
    watch: Watch,
    options: SearchExecutionOptions,
  ) => Promise<CarPartSearchResult>,
  watch: Watch,
  options: {
    maxAttempts?: number;
    backoffDelaysMs?: number[];
    maxRunTimeMs?: number;
    attemptTimeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<CarPartSearchResult> {
  const began = performance.now();
  const maxAttempts = options.maxAttempts ?? 3;
  const backoffDelays = options.backoffDelaysMs ?? [3_000, 8_000];
  const maxRunTimeMs = options.maxRunTimeMs ?? 10 * 60 * 1000;
  const runDeadline = began + maxRunTimeMs;

  let result: CarPartSearchResult | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    throwIfAborted(options.signal);
    const remainingTime = Math.max(0, runDeadline - performance.now());
    if (remainingTime <= 0) {
      throw new CarPartSearchError(
        "RUN_TIMEOUT",
        `Search run exceeded the ${
          Math.round(maxRunTimeMs / 60000)
        }-minute maximum limit`,
      );
    }

    const timeoutMs = Math.min(
      options.attemptTimeoutMs ?? remainingTime,
      remainingTime,
    );
    const timeoutMessage = options.attemptTimeoutMs === undefined
      ? `Search run exceeded the ${
        Math.round(maxRunTimeMs / 60000)
      }-minute maximum limit`
      : `Search attempt ${attempt} exceeded its time limit`;
    const attemptController = new AbortController();
    const timeout = setTimeout(() => {
      attemptController.abort(
        new CarPartSearchError(
          "RUN_TIMEOUT",
          timeoutMessage,
        ),
      );
    }, timeoutMs);
    const combined = combineSignals([options.signal, attemptController.signal]);

    try {
      result = await search(watch, { signal: combined.signal });
      throwIfAborted(combined.signal);
      break;
    } catch (error) {
      lastError = combined.signal.aborted
        ? cancellationError(combined.signal)
        : error;
    } finally {
      clearTimeout(timeout);
      combined.dispose();
    }

    const isRetryable = isRetryableError(lastError);
    if (attempt < maxAttempts && isRetryable) {
      const delay = backoffDelays[attempt - 1] ?? 5_000;
      const remainingAfter = runDeadline - performance.now();
      if (remainingAfter <= delay) break;
      const errDesc = lastError instanceof Error
        ? lastError.message
        : String(lastError);
      console.warn(
        `[Watch ${watch.name}] Search attempt ${attempt}/${maxAttempts} failed: ${errDesc}. Retrying in ${delay}ms...`,
      );
      await waitForDelay(delay, options.signal);
    } else {
      break;
    }
  }

  if (!result) {
    throw lastError ?? new Error("Search run failed with no result");
  }

  return result;
}
