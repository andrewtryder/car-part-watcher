import {
  LocalBrowserProvider,
  runCarPartSearch,
} from "./src/browser/car_part_browser.ts";
import { SpikeError } from "./src/types.ts";

const endpoint = "/_dev/search-spike";

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (url.pathname !== endpoint) {
    return new Response("Not found", { status: 404 });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }
  const token = Deno.env.get("SEARCH_SPIKE_TOKEN");
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`) {
    return new Response("Not found", { status: 404 });
  }
  try {
    return Response.json(await runCarPartSearch(new LocalBrowserProvider()));
  } catch (error) {
    const body = error instanceof SpikeError ? error.toJSON() : {
      error: { code: "UNEXPECTED_PAGE", message: "Unexpected spike failure" },
    };
    return Response.json(body, { status: 502 });
  }
});
