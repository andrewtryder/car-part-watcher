import { getCatalog, refreshCatalog } from "./src/services/catalog_service.ts";
import "./src/cron.ts";
import { withConsoleAuthentication } from "./src/console_auth.ts";
import {
  listInboxNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationCounts,
  retryNotificationEvent,
} from "./src/repositories/notification_repository.ts";
import { appTimezone } from "./src/services/scheduling_service.ts";
import { getDashboard } from "./src/services/dashboard_service.ts";
import {
  deleteWatch,
  executeWatch,
  getWatch,
  listRecentSearchRuns,
  listSearchRuns,
  listWatches,
  listWatchListings,
  resolveWatch,
  saveWatch,
  validateWatch,
} from "./src/services/watch_service.ts";
import { ListingIdentityCollisionError } from "./src/reconciliation.ts";
import { SpikeError } from "./src/types.ts";
import type { CarPartSearchRequest } from "./src/types.ts";

const json = (body: unknown, status = 200) => Response.json(body, { status });

function parseLimitParam(
  param: string | null,
  defaultValue = 50,
  max = 100,
): number {
  if (!param) return defaultValue;
  const num = Number(param);
  if (!Number.isFinite(num) || num < 1) return defaultValue;
  return Math.min(Math.floor(num), max);
}
const assetTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};
function request(value: Record<string, unknown>): CarPartSearchRequest {
  return {
    year: String(value.year ?? ""),
    makeModel: String(value.makeModel ?? ""),
    part: String(value.part ?? ""),
    location: (value.location as string) || undefined,
    sort: (value.sort as CarPartSearchRequest["sort"]) ?? "price",
    postalCode: (value.postalCode as string) || undefined,
    refinement: value.refinementLabel
      ? { label: String(value.refinementLabel) }
      : undefined,
  };
}
function watchDraft(
  body: Record<string, unknown>,
  existing?: { id: string; createdAt: string; updatedAt: string },
) {
  return {
    ...request(body),
    name: (body.name as string) ?? "",
    enabled: body.enabled !== false,
    scheduleEnabled: body.scheduleEnabled === true,
    runFrequency: [1, 2, 3].includes(Number(body.runFrequency))
      ? Number(body.runFrequency) as 1 | 2 | 3
      : 1,
    notifyOnInitialRun: body.notifyOnInitialRun === true,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? "",
    updatedAt: existing?.updatedAt ?? "",
  };
}
async function consoleAsset(pathname: string) {
  const requested = pathname === "/"
    ? "index.html"
    : decodeURIComponent(pathname.slice(1));
  if (requested.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const isAsset = requested.includes(".");
  try {
    const content = await Deno.readFile(
      new URL(`./web/dist/${requested}`, import.meta.url),
    );
    const extension = requested.slice(requested.lastIndexOf("."));
    return new Response(content, {
      headers: {
        "content-type": assetTypes[extension] ?? "application/octet-stream",
        "cache-control": requested === "index.html"
          ? "no-cache"
          : "public, max-age=31536000, immutable",
      },
    });
  } catch {
    if (isAsset) return new Response("Not found", { status: 404 });
    const index = await Deno.readFile(
      new URL("./web/dist/index.html", import.meta.url),
    );
    return new Response(index, {
      headers: {
        "content-type": assetTypes[".html"],
        "cache-control": "no-cache",
      },
    });
  }
}

export async function handleConsoleRequest(req: Request) {
  const url = new URL(req.url);
  try {
    if (url.pathname === "/api/dashboard" && req.method === "GET") {
      return json(await getDashboard());
    }
    if (url.pathname === "/api/catalog" && req.method === "GET") {
      const catalog = await getCatalog();
      return catalog
        ? json({
          source: catalog.source,
          fetchedAt: catalog.fetchedAt,
          ...catalog.payload,
        })
        : json({ error: "Catalog is not initialized" }, 404);
    }
    if (url.pathname === "/api/catalog/refresh" && req.method === "POST") {
      const catalog = await refreshCatalog();
      return json({
        ok: true,
        fetchedAt: catalog!.fetchedAt,
        counts: Object.fromEntries(
          Object.entries(catalog!.payload).map((
            [key, value],
          ) => [key, value.length]),
        ),
      });
    }
    if (url.pathname === "/api/system" && req.method === "GET") {
      return json({
        timezone: appTimezone(),
        notifications: await notificationCounts(),
      });
    }
    if (url.pathname === "/api/notifications" && req.method === "GET") {
      return json(
        await listInboxNotifications({
          unread: url.searchParams.get("status") !== "all",
          watchId: url.searchParams.get("watchId") ?? undefined,
          limit: parseLimitParam(url.searchParams.get("limit"), 50, 100),
          eventType: url.searchParams.get("type") ?? undefined,
        }),
      );
    }
    if (
      url.pathname === "/api/notifications/mark-all-read" &&
      req.method === "POST"
    ) {
      const body = await req.json().catch(() => ({}));
      await markAllNotificationsRead(body.watchId);
      return json({ ok: true });
    }
    const readEventId = url.pathname.match(
      /^\/api\/notifications\/([\w-]+)\/read$/,
    )?.[1];
    if (readEventId && req.method === "POST") {
      await markNotificationRead(readEventId);
      return json({ ok: true });
    }
    const retryEventId = url.pathname.match(
      /^\/api\/notifications\/([\w-]+)\/retry$/,
    )?.[1];
    if (retryEventId && req.method === "POST") {
      await retryNotificationEvent(retryEventId);
      return json({ ok: true });
    }
    if (url.pathname === "/api/watches" && req.method === "GET") {
      return json(await listWatches());
    }
    if (url.pathname === "/api/runs" && req.method === "GET") {
      return json(
        await listRecentSearchRuns(
          parseLimitParam(url.searchParams.get("limit"), 50, 100),
        ),
      );
    }
    if (url.pathname === "/api/watches/resolve" && req.method === "POST") {
      return json(
        await resolveWatch(
          request((await req.json()) as Record<string, unknown>),
        ),
      );
    }
    if (url.pathname === "/api/watches" && req.method === "POST") {
      const draft = watchDraft((await req.json()) as Record<string, unknown>);
      await validateWatch(draft);
      return json(await saveWatch(draft), 201);
    }
    const runId = url.pathname.match(/^\/api\/watches\/([\w-]+)\/run$/)?.[1];
    if (runId && req.method === "POST") {
      const run = await executeWatch(runId, { maxRunTimeMs: 120_000 });
      return run
        ? json({
          ...run,
          newListings: run.newListings.map((listing) => ({
            year: listing.year,
            makeModel: listing.makeModel,
            part: listing.part,
            description: listing.description,
            grade: listing.grade,
            stockNumber: listing.stockNumber,
            priceDisplay: listing.priceDisplay,
            recyclerName: listing.recyclerName,
            recyclerLocation: listing.recyclerLocation,
          })),
        })
        : json({ skipped: true });
    }
    const historyId = url.pathname.match(/^\/api\/watches\/([\w-]+)\/runs$/)
      ?.[1];
    if (historyId && req.method === "GET") {
      return json(await listSearchRuns(historyId));
    }
    const listingWatchId = url.pathname.match(
      /^\/api\/watches\/([\w-]+)\/listings$/,
    )?.[1];
    if (listingWatchId && req.method === "GET") {
      if (!await getWatch(listingWatchId)) {
        return json({ error: "Not found" }, 404);
      }
      return json(
        await listWatchListings(
          listingWatchId,
          parseLimitParam(url.searchParams.get("limit"), 500, 1000),
        ),
      );
    }
    const id = url.pathname.match(/^\/api\/watches\/([\w-]+)$/)?.[1];
    if (id && req.method === "GET") {
      const watch = await getWatch(id);
      return watch ? json(watch) : json({ error: "Not found" }, 404);
    }
    if (id && req.method === "PUT") {
      const existing = await getWatch(id);
      if (!existing) return json({ error: "Not found" }, 404);
      const draft = watchDraft(
        (await req.json()) as Record<string, unknown>,
        existing,
      );
      await validateWatch(draft);
      return json(await saveWatch(draft));
    }
    if (id && req.method === "DELETE") {
      return (await deleteWatch(id))
        ? new Response(null, { status: 204 })
        : json({ error: "Not found" }, 404);
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }
    return await consoleAsset(url.pathname);
  } catch (error) {
    let status = 500;
    let message = "Request failed";
    let code: string | undefined;

    if (error instanceof ListingIdentityCollisionError) {
      status = 409;
      message = error.message;
      code = error.code;
    } else if (error instanceof SpikeError) {
      code = error.code;
      message = error.message;
      switch (error.code) {
        case "RUN_TIMEOUT":
        case "REMOTE_BROWSER_TIMEOUT":
          status = 504;
          break;
        case "ACCESS_CHALLENGE":
          status = 503;
          break;
        case "REMOTE_BROWSER_CREATE_FAILED":
        case "REMOTE_CDP_CONNECTION_FAILED":
        case "REMOTE_BROWSER_DISCONNECTED":
        case "PAGE_LOAD_FAILED":
        case "FORM_SUBMIT_FAILED":
        case "CDP_CONNECTION_FAILED":
          status = 502;
          break;
        case "REFINEMENT_REQUIRED":
        case "SEARCH_OPTION_NOT_FOUND":
        case "REFINEMENT_OPTION_NOT_FOUND":
          status = 400;
          break;
        default:
          status = 502;
      }
    } else if (error instanceof Error) {
      message = error.message;
      if (message === "Watch not found" || message === "Not found") {
        status = 404;
      } else if (
        message.includes("is required") ||
        message.includes("Watch criteria are not present") ||
        message.includes("Postal code is required") ||
        message.includes("Catalog is not initialized")
      ) {
        status = 400;
      } else if (
        "status" in error &&
        typeof (error as { status: unknown }).status === "number"
      ) {
        status = (error as { status: number }).status;
      }
    }

    return json({
      error: message,
      ...(code ? { code } : {}),
    }, status);
  }
}

Deno.serve((req) =>
  withConsoleAuthentication(
    req,
    () => handleConsoleRequest(req),
  )
);
