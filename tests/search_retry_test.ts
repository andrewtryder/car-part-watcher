import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.19";
import { executeSearchWithRetry } from "../src/services/search_retry.ts";
import { SpikeError, type SpikeResult } from "../src/types.ts";
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

const mockResult: SpikeResult = {
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
      throw new SpikeError("PAGE_LOAD_FAILED", "Transient page load failure");
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
    throw new SpikeError("REFINEMENT_REQUIRED", "Refinement required");
  };

  await assertRejects(
    () =>
      executeSearchWithRetry(runner, mockWatch, {
        maxAttempts: 3,
        backoffDelaysMs: [10, 10],
      }),
    SpikeError,
    "Refinement required",
  );

  assertEquals(callCount, 1);
});

Deno.test("exhausts max attempts and throws last error", async () => {
  let callCount = 0;
  const runner = () => {
    callCount++;
    throw new SpikeError(
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
    SpikeError,
    "Browser disconnected",
  );

  assertEquals(callCount, 3);
});

Deno.test("aborts with RUN_TIMEOUT when run exceeds max duration", async () => {
  const hangingRunner = () =>
    new Promise<SpikeResult>((resolve) => {
      setTimeout(() => resolve(mockResult), 200);
    });

  await assertRejects(
    () =>
      executeSearchWithRetry(hangingRunner, mockWatch, {
        maxAttempts: 3,
        maxRunTimeMs: 30,
      }),
    SpikeError,
    "Search run exceeded",
  );
});
