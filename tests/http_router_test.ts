import { assertEquals } from "jsr:@std/assert@1.0.19";
import { mapErrorToResponse, parseLimitParam } from "../src/http/errors.ts";
import { routeRequest } from "../src/http/router.ts";
import {
  parseSearchRequest,
  parseWatchDraft,
} from "../src/http/watch_handlers.ts";
import { ListingIdentityCollisionError } from "../src/reconciliation.ts";
import { CarPartSearchError } from "../src/types.ts";

Deno.test("parseLimitParam sanitizes bounds and fallbacks", () => {
  assertEquals(parseLimitParam(null, 50, 100), 50);
  assertEquals(parseLimitParam("not-a-number", 50, 100), 50);
  assertEquals(parseLimitParam("-5", 50, 100), 50);
  assertEquals(parseLimitParam("0", 50, 100), 50);
  assertEquals(parseLimitParam("25", 50, 100), 25);
  assertEquals(parseLimitParam("500", 50, 100), 100);
});

Deno.test("parseSearchRequest extracts typed search fields", () => {
  const parsed = parseSearchRequest({
    year: 2018,
    makeModel: "Subaru Outback",
    part: "Headlight",
    location: "USA",
    sort: "distance",
    postalCode: "03301",
    refinementLabel: "Left halogen",
  });
  assertEquals(parsed.year, "2018");
  assertEquals(parsed.makeModel, "Subaru Outback");
  assertEquals(parsed.part, "Headlight");
  assertEquals(parsed.location, "USA");
  assertEquals(parsed.sort, "distance");
  assertEquals(parsed.postalCode, "03301");
  assertEquals(parsed.refinement, { label: "Left halogen" });
});

Deno.test("parseWatchDraft generates valid default watch draft", () => {
  const draft = parseWatchDraft({
    name: "Subaru Headlight",
    year: "2018",
    makeModel: "Subaru Outback",
    part: "Headlight",
    runFrequency: 2,
    scheduleEnabled: true,
    notifyOnInitialRun: true,
  });
  assertEquals(draft.name, "Subaru Headlight");
  assertEquals(draft.runFrequency, 2);
  assertEquals(draft.scheduleEnabled, true);
  assertEquals(draft.notifyOnInitialRun, true);
  assertEquals(typeof draft.id, "string");
});

Deno.test("mapErrorToResponse maps collision errors to 409", async () => {
  const collisionErr = new ListingIdentityCollisionError("Conflict detected");
  const res = mapErrorToResponse(collisionErr);
  assertEquals(res.status, 409);
  const data = await res.json();
  assertEquals(data.code, "LISTING_IDENTITY_COLLISION");
  assertEquals(
    data.error,
    "Multiple visibly different results produced Conflict detected",
  );
});

Deno.test("mapErrorToResponse maps CarPartSearchErrors to appropriate gateway/timeout statuses", async () => {
  const timeoutRes = mapErrorToResponse(
    new CarPartSearchError("RUN_TIMEOUT", "Exceeded time limit"),
  );
  assertEquals(timeoutRes.status, 504);
  assertEquals((await timeoutRes.json()).code, "RUN_TIMEOUT");

  const challengeRes = mapErrorToResponse(
    new CarPartSearchError("ACCESS_CHALLENGE", "Captcha blocked"),
  );
  assertEquals(challengeRes.status, 503);

  const refinementRes = mapErrorToResponse(
    new CarPartSearchError("REFINEMENT_REQUIRED", "Please select option"),
  );
  assertEquals(refinementRes.status, 400);

  const browserRes = mapErrorToResponse(
    new CarPartSearchError("PAGE_LOAD_FAILED", "Network failed"),
  );
  assertEquals(browserRes.status, 502);
});

Deno.test("mapErrorToResponse maps standard errors to 404, 400, or 500", () => {
  const notFoundRes = mapErrorToResponse(new Error("Watch not found"));
  assertEquals(notFoundRes.status, 404);

  const validationRes = mapErrorToResponse(
    new Error("Postal code is required"),
  );
  assertEquals(validationRes.status, 400);

  const serverErrRes = mapErrorToResponse(
    new Error("Internal unexpected crash"),
  );
  assertEquals(serverErrRes.status, 500);
});

Deno.test("routeRequest returns 404 for unknown api endpoint", async () => {
  const req = new Request("https://example.test/api/unknown-endpoint");
  const res = await routeRequest(req);
  assertEquals(res.status, 404);
  const data = await res.json();
  assertEquals(data.error, "Not found");
});

Deno.test("routeRequest blocks directory traversal attempts", async () => {
  const req = new Request("https://example.test/../secret.txt");
  const res = await routeRequest(req);
  assertEquals(res.status, 404);
});
