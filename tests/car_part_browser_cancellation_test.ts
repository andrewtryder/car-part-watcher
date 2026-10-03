import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.19";
import {
  type BrowserSession,
  runCarPartSearch,
} from "../src/browser/car_part_browser.ts";
import { CarPartSearchError } from "../src/types.ts";

Deno.test("cancellation closes a session created while connection was pending", async () => {
  let resolveSession: (session: BrowserSession) => void = () => {};
  const sessionPromise = new Promise<BrowserSession>((resolve) => {
    resolveSession = resolve;
  });
  let closeCalls = 0;
  const session = {
    context: {},
    close: () => {
      closeCalls++;
      return Promise.resolve();
    },
  } as BrowserSession;
  const controller = new AbortController();
  const run = runCarPartSearch(
    { createSession: () => sessionPromise },
    undefined,
    undefined,
    { signal: controller.signal },
  );

  controller.abort();
  resolveSession(session);

  const error = await assertRejects(
    () => run,
    CarPartSearchError,
    "Search run was cancelled",
  );
  assertEquals(error.code, "RUN_CANCELLED");
  assertEquals(closeCalls, 1);
});
