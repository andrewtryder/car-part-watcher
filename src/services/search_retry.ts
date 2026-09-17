import { SpikeError, type SpikeResult } from "../types.ts";
import type { Watch } from "../repositories/watch_repository.ts";

export function isRetryableError(error: unknown): boolean {
  if (error instanceof SpikeError) {
    if (
      error.code === "REFINEMENT_REQUIRED" ||
      error.code === "REFINEMENT_OPTION_NOT_FOUND"
    ) {
      return false;
    }
    return true;
  }
  return true;
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage = "Search run timed out",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new SpikeError("RUN_TIMEOUT", timeoutMessage));
    }, ms);
  });
  return Promise.race([
    promise.finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    }),
    timeoutPromise,
  ]);
}

export async function executeSearchWithRetry(
  search: (watch: Watch) => Promise<SpikeResult>,
  watch: Watch,
  options: {
    maxAttempts?: number;
    backoffDelaysMs?: number[];
    maxRunTimeMs?: number;
  } = {},
): Promise<SpikeResult> {
  const began = performance.now();
  const maxAttempts = options.maxAttempts ?? 3;
  const backoffDelays = options.backoffDelaysMs ?? [3_000, 8_000];
  const maxRunTimeMs = options.maxRunTimeMs ?? 10 * 60 * 1000;
  const runDeadline = began + maxRunTimeMs;

  let result: SpikeResult | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const remainingTime = Math.max(0, runDeadline - performance.now());
    if (remainingTime <= 0) {
      throw new SpikeError(
        "RUN_TIMEOUT",
        `Search run exceeded the ${Math.round(maxRunTimeMs / 60000)}-minute maximum limit`,
      );
    }

    try {
      result = await withTimeout(
        search(watch),
        remainingTime,
        `Search run exceeded the ${Math.round(maxRunTimeMs / 60000)}-minute maximum limit`,
      );
      break;
    } catch (err) {
      lastError = err;
      const isRetryable = isRetryableError(err);
      if (attempt < maxAttempts && isRetryable) {
        const delay = backoffDelays[attempt - 1] ?? 5_000;
        const remainingAfter = runDeadline - performance.now();
        if (remainingAfter <= delay) {
          break;
        }
        const errDesc = err instanceof Error ? err.message : String(err);
        console.warn(
          `[Watch ${watch.name}] Search attempt ${attempt}/${maxAttempts} failed: ${errDesc}. Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  if (!result) {
    throw lastError ?? new Error("Search run failed with no result");
  }

  return result;
}
