import { json, mapErrorToResponse } from "./errors.ts";
import { consoleAsset } from "./static_assets.ts";
import {
  handleGetCatalog,
  handleGetDashboard,
  handleGetSystem,
  handleRefreshCatalog,
} from "./catalog_handlers.ts";
import {
  handleListNotifications,
  handleMarkAllNotificationsRead,
  handleMarkNotificationRead,
  handleRetryNotification,
} from "./notification_handlers.ts";
import {
  handleCreateWatch,
  handleDeleteWatch,
  handleGetWatch,
  handleListRecentRuns,
  handleListWatches,
  handleListWatchListings,
  handleListWatchRuns,
  handleResolveWatch,
  handleRunWatch,
  handleUpdateWatch,
} from "./watch_handlers.ts";

export async function routeRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  try {
    // Catalog & Dashboard & System
    if (path === "/api/dashboard" && method === "GET") {
      return await handleGetDashboard();
    }
    if (path === "/api/catalog" && method === "GET") {
      return await handleGetCatalog();
    }
    if (path === "/api/catalog/refresh" && method === "POST") {
      return await handleRefreshCatalog();
    }
    if (path === "/api/system" && method === "GET") {
      return await handleGetSystem();
    }

    // Notifications
    if (path === "/api/notifications" && method === "GET") {
      return await handleListNotifications(req, url);
    }
    if (path === "/api/notifications/mark-all-read" && method === "POST") {
      return await handleMarkAllNotificationsRead(req);
    }
    const readEventId = path.match(/^\/api\/notifications\/([\w-]+)\/read$/)
      ?.[1];
    if (readEventId && method === "POST") {
      return await handleMarkNotificationRead(readEventId);
    }
    const retryEventId = path.match(/^\/api\/notifications\/([\w-]+)\/retry$/)
      ?.[1];
    if (retryEventId && method === "POST") {
      return await handleRetryNotification(retryEventId);
    }

    // Runs & Watches
    if (path === "/api/runs" && method === "GET") {
      return await handleListRecentRuns(url);
    }
    if (path === "/api/watches/resolve" && method === "POST") {
      return await handleResolveWatch(req);
    }
    if (path === "/api/watches" && method === "GET") {
      return await handleListWatches();
    }
    if (path === "/api/watches" && method === "POST") {
      return await handleCreateWatch(req);
    }

    const runWatchId = path.match(/^\/api\/watches\/([\w-]+)\/run$/)?.[1];
    if (runWatchId && method === "POST") {
      return await handleRunWatch(runWatchId);
    }
    const historyWatchId = path.match(/^\/api\/watches\/([\w-]+)\/runs$/)?.[1];
    if (historyWatchId && method === "GET") {
      return await handleListWatchRuns(historyWatchId);
    }
    const listingWatchId = path.match(/^\/api\/watches\/([\w-]+)\/listings$/)
      ?.[1];
    if (listingWatchId && method === "GET") {
      return await handleListWatchListings(url, listingWatchId);
    }

    const watchId = path.match(/^\/api\/watches\/([\w-]+)$/)?.[1];
    if (watchId && method === "GET") {
      return await handleGetWatch(watchId);
    }
    if (watchId && method === "PUT") {
      return await handleUpdateWatch(req, watchId);
    }
    if (watchId && method === "DELETE") {
      return await handleDeleteWatch(watchId);
    }

    // Unknown API routes
    if (path.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }

    // Static assets & SPA
    return await consoleAsset(path);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
