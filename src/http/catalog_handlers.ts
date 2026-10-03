import { getCatalog, refreshCatalog } from "../services/catalog_service.ts";
import { getDashboard } from "../services/dashboard_service.ts";
import { notificationCounts } from "../repositories/notification_repository.ts";
import { appTimezone } from "../services/scheduling_service.ts";
import { json } from "./errors.ts";
import type { CarPartSearchClient } from "../search/car_part_search_client.ts";
import type {
  CatalogRefreshDto,
  DashboardDto,
  SystemStatusDto,
} from "../contracts/dashboard.ts";
import type { CatalogDto } from "../contracts/watches.ts";

export async function handleGetDashboard(): Promise<Response> {
  return json<DashboardDto>(await getDashboard());
}

export async function handleGetCatalog(): Promise<Response> {
  const catalog = await getCatalog();
  return catalog
    ? json<CatalogDto>({
      source: catalog.source,
      fetchedAt: catalog.fetchedAt,
      ...catalog.payload,
    })
    : json({ error: "Catalog is not initialized" }, 404);
}

export async function handleRefreshCatalog(
  searchClient: CarPartSearchClient,
): Promise<Response> {
  const catalog = await refreshCatalog(searchClient);
  return json<CatalogRefreshDto>({
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
  return json<SystemStatusDto>({
    timezone: appTimezone(),
    notifications: await notificationCounts(),
  });
}
