import {
  ChromeBrowserProvider,
  runCarPartSearch,
} from "./browser/car_part_browser.ts";
import { type CarPartSearchRequest, SpikeError } from "./types.ts";

const token = Deno.env.get("BROWSER_WORKER_TOKEN");
let activeSearch = false;

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

async function authorized(request: Request) {
  const supplied = request.headers.get("authorization");
  if (!token || !supplied) return false;
  const encoder = new TextEncoder();
  const [expected, actual] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(`Bearer ${token}`)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  ]);
  const expectedBytes = new Uint8Array(expected);
  const actualBytes = new Uint8Array(actual);
  return expectedBytes.length === actualBytes.length &&
    expectedBytes.every((value, index) => value === actualBytes[index]);
}

function isRequest(value: unknown): value is CarPartSearchRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["year", "makeModel", "part", "sort"].every((key) =>
    typeof candidate[key] === "string" && candidate[key].length > 0
  ) &&
    (candidate.location === undefined ||
      typeof candidate.location === "string") &&
    (candidate.postalCode === undefined ||
      typeof candidate.postalCode === "string") &&
    (candidate.refinement === undefined ||
      (typeof candidate.refinement === "object" &&
        candidate.refinement !== null &&
        typeof (candidate.refinement as Record<string, unknown>).label ===
          "string"));
}

Deno.serve(async (request) => {
  const { pathname } = new URL(request.url);
  if (pathname === "/health" && request.method === "GET") {
    return json({ ok: true });
  }
  if (pathname !== "/search") return new Response("Not found", { status: 404 });
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }
  if (!await authorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (activeSearch) {
    return json({
      error: { code: "WORKER_BUSY", message: "A search is already running" },
    }, 503);
  }

  const body = await request.json().catch(() => undefined);
  if (!isRequest(body)) {
    return json({
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid Car-Part search request",
      },
    }, 400);
  }
  activeSearch = true;
  try {
    return json(
      await runCarPartSearch(new ChromeBrowserProvider("chrome-headed"), body),
    );
  } catch (error) {
    const response = error instanceof SpikeError
      ? error.toJSON()
      : { error: { code: "WORKER_FAILURE", message: "Browser worker failed" } };
    return json(response, 502);
  } finally {
    activeSearch = false;
  }
});
