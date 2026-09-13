import type { CarPartSearchRequest, SpikeResult } from "./types.ts";

export interface PartsSource {
  search(request: CarPartSearchRequest): Promise<SpikeResult>;
}

export type SourceErrorCode =
  | "WORKER_UNAVAILABLE"
  | "WORKER_TIMEOUT"
  | "ACCESS_CHALLENGE"
  | "REFINEMENT_MISSING"
  | "SEARCH_OPTION_INVALID"
  | "RESULTS_PARSE_FAILED";

export class SourceError extends Error {
  constructor(public readonly code: SourceErrorCode, message: string) {
    super(message);
  }
}

export class CarPartRemoteSource implements PartsSource {
  constructor(
    private readonly url = Deno.env.get("CAR_PART_WORKER_URL"),
    private readonly token = Deno.env.get("CAR_PART_WORKER_TOKEN"),
  ) {}

  async search(request: CarPartSearchRequest): Promise<SpikeResult> {
    if (!this.url || !this.token) {
      throw new SourceError(
        "WORKER_UNAVAILABLE",
        "Car-Part worker is not configured",
      );
    }
    let response: Response;
    try {
      response = await fetch(new URL("/search", this.url), {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(70_000),
      });
    } catch (error) {
      throw new SourceError(
        error instanceof DOMException && error.name === "TimeoutError"
          ? "WORKER_TIMEOUT"
          : "WORKER_UNAVAILABLE",
        "Car-Part worker request failed",
      );
    }
    const body = await response.json().catch(() => ({})) as {
      error?: { code?: string };
      search?: unknown;
    };
    if (response.ok) return body as SpikeResult;
    const code = body.error?.code;
    if (code === "ACCESS_CHALLENGE") {
      throw new SourceError(
        "ACCESS_CHALLENGE",
        "Car-Part presented an access challenge",
      );
    }
    if (
      code === "REFINEMENT_OPTION_NOT_FOUND" || code === "REFINEMENT_REQUIRED"
    ) {
      throw new SourceError(
        "REFINEMENT_MISSING",
        "Requested refinement is unavailable",
      );
    }
    if (code === "SEARCH_OPTION_NOT_FOUND") {
      throw new SourceError(
        "SEARCH_OPTION_INVALID",
        "Requested search option is unavailable",
      );
    }
    if (code === "RESULTS_PARSE_FAILED") {
      throw new SourceError(
        "RESULTS_PARSE_FAILED",
        "Worker could not parse results",
      );
    }
    throw new SourceError(
      "WORKER_UNAVAILABLE",
      "Car-Part worker returned an error",
    );
  }
}
