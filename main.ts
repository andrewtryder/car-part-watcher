import { CarPartRemoteSource, SourceError } from "./src/parts_source.ts";
import { WatchStore } from "./src/watch_store.ts";
import type { CarPartSearchRequest } from "./src/types.ts";

const kv = await Deno.openKv();
const store = new WatchStore(kv);
const manualToken = Deno.env.get("MANUAL_RUN_TOKEN");

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function isRequest(value: unknown): value is CarPartSearchRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return ["year", "makeModel", "part", "sort"].every((key) =>
    typeof body[key] === "string" && body[key].length > 0
  ) && (body.location === undefined || typeof body.location === "string") &&
    (body.postalCode === undefined || typeof body.postalCode === "string") &&
    (body.refinement === undefined ||
      (typeof body.refinement === "object" && body.refinement !== null &&
        typeof (body.refinement as Record<string, unknown>).label ===
          "string"));
}

function isAuthorized(request: Request) {
  return Boolean(manualToken) &&
    request.headers.get("authorization") === `Bearer ${manualToken}`;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    return json({ status: "ok" });
  }
  if (!url.pathname.startsWith("/_dev/")) {
    return new Response("Not found", { status: 404 });
  }
  if (!isAuthorized(request)) return new Response("Not found", { status: 404 });

  if (url.pathname === "/_dev/watches" && request.method === "POST") {
    const body = await request.json().catch(() => undefined);
    if (!isRequest(body)) {
      return json({
        error: { code: "INVALID_REQUEST", message: "Invalid watch request" },
      }, 400);
    }
    return json(await store.createWatch(body), 201);
  }

  const match = url.pathname.match(/^\/_dev\/watches\/([^/]+)\/run$/);
  if (match && request.method === "POST") {
    const watch = await store.getWatch(match[1]);
    if (!watch) {
      return json({
        error: { code: "WATCH_NOT_FOUND", message: "Watch not found" },
      }, 404);
    }
    try {
      return json(await store.runWatch(watch, new CarPartRemoteSource()));
    } catch (error) {
      const safe = error instanceof SourceError
        ? { code: error.code, message: error.message }
        : { code: "SEARCH_FAILED", message: "Watch search failed" };
      return json({ error: safe }, 502);
    }
  }
  return new Response("Not found", { status: 404 });
});
