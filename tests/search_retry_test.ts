import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.19";
import { executeSearchWithRetry } from "../src/services/search_retry.ts";
import { CarPartSearchError, type CarPartSearchResult } from "../src/types.ts";
import type { Watch } from "../src/repositories/watch_repository.ts";

const mockWatch: Watch = {
  id: "watch-1",
  name: "2015 Accord Alternator",
  enabled: true,
  year: "2015",
  makeModel: "Honda Accord",
  part: "Alternator",
  sort: "price",
  scheduleEnabled: true,
  runFrequency: 1,
  notifyOnInitialRun: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const mockResult: CarPartSearchResult = {
  search: {
    year: "2015",
    makeModel: "Honda Accord",
    part: "Alternator",
    sort: "price",
  },
  results: {
    count: 1,
    hasNextPage: false,
    listings: [
      {
        year: "2015",
        makeModel: "Honda Accord",
        part: "Alternator",
        sellerUserId: "100",
        partGuid: "guid-1",
        stockNumber: "STK-1",
        price: { amount: 120, currency: "USD", display: "$120" },
      },
    ],
  },
};

Deno.test("succeeds on first attempt without retrying", async () => {
  let callCount = 0;
  const runner = () => {
    callCount++;
    return Promise.resolve(mockResult);
  };

  const res = await executeSearchWithRetry(runner, mockWatch, {
    maxAttempts: 3,
  });

  assertEquals(callCount, 1);
  assertEquals(res.results.count, 1);
});

Deno.test("retries transient failures and succeeds on subsequent attempt", async () => {
  let callCount = 0;
  const runner = () => {
    callCount++;
    if (callCount < 3) {
      throw new CarPartSearchError(
        "PAGE_LOAD_FAILED",
        "Transient page load failure",
      );
    }
    return Promise.resolve(mockResult);
  };

  const res = await executeSearchWithRetry(runner, mockWatch, {
    maxAttempts: 3,
    backoffDelaysMs: [10, 10],
  });

  assertEquals(callCount, 3);
  assertEquals(res.results.count, 1);
});

Deno.test("does not retry non-retryable error REFINEMENT_REQUIRED", async () => {
  let callCount = 0;
  const runner = () => {
    callCount++;
    throw new CarPartSearchError("REFINEMENT_REQUIRED", "Refinement required");
  };

  await assertRejects(
    () =>
      executeSearchWithRetry(runner, mockWatch, {
        maxAttempts: 3,
        backoffDelaysMs: [10, 10],
      }),
    CarPartSearchError,
    "Refinement required",
  );

  assertEquals(callCount, 1);
});

Deno.test("exhausts max attempts and throws last error", async () => {
  let callCount = 0;
  const runner = () => {
    callCount++;
    throw new CarPartSearchError(
      "REMOTE_BROWSER_DISCONNECTED",
      "Browser disconnected",
    );
  };

  await assertRejects(
    () =>
      executeSearchWithRetry(runner, mockWatch, {
        maxAttempts: 3,
        backoffDelaysMs: [5, 5],
      }),
    CarPartSearchError,
    "Browser disconnected",
  );

  assertEquals(callCount, 3);
});

Deno.test("aborts with RUN_TIMEOUT when run exceeds max duration", async () => {
  const hangingRunner = (_watch: Watch, options: { signal?: AbortSignal }) =>
    new Promise<CarPartSearchResult>((_resolve, reject) => {
      options.signal?.addEventListener(
        "abort",
        () => reject(options.signal?.reason),
        {
          once: true,
        },
      );
    });

  await assertRejects(
    () =>
      executeSearchWithRetry(hangingRunner, mockWatch, {
        maxAttempts: 3,
        maxRunTimeMs: 30,
      }),
    CarPartSearchError,
    "Search run exceeded",
  );
});

Deno.test("waits for a timed-out attempt to terminate before retrying", async () => {
  let attempts = 0;
  let activeAttempts = 0;
  let secondStartedAfterCleanup = false;
  const runner = (_watch: Watch, options: { signal?: AbortSignal }) => {
    attempts++;
    activeAttempts++;
    if (attempts === 2) {
      secondStartedAfterCleanup = activeAttempts === 1;
      activeAttempts--;
      return Promise.resolve(mockResult);
    }
    return new Promise<CarPartSearchResult>((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => {
        setTimeout(() => {
          activeAttempts--;
          reject(options.signal?.reason);
        }, 10);
      }, { once: true });
    });
  };

  const result = await executeSearchWithRetry(runner, mockWatch, {
    maxAttempts: 2,
    attemptTimeoutMs: 5,
    backoffDelaysMs: [0],
    maxRunTimeMs: 1_000,
  });

  assertEquals(result, mockResult);
  assertEquals(attempts, 2);
  assertEquals(secondStartedAfterCleanup, true);
  assertEquals(activeAttempts, 0);
});
