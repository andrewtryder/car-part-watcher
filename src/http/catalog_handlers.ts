import { getCatalog, refreshCatalog } from "../services/catalog_service.ts";
import { getDashboard } from "../services/dashboard_service.ts";
import { notificationCounts } from "../repositories/notification_repository.ts";
import { appTimezone } from "../services/scheduling_service.ts";
import { json } from "./errors.ts";

export async function handleGetDashboard(): Promise<Response> {
  return json(await getDashboard());
}

export async function handleGetCatalog(): Promise<Response> {
  const catalog = await getCatalog();
  return catalog
    ? json({
      source: catalog.source,
      fetchedAt: catalog.fetchedAt,
      ...catalog.payload,
    })
    : json({ error: "Catalog is not initialized" }, 404);
}

export async function handleRefreshCatalog(): Promise<Response> {
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

export async function handleGetSystem(): Promise<Response> {
  return json({
    timezone: appTimezone(),
    notifications: await notificationCounts(),
  });
}
