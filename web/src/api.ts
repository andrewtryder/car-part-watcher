import type {
  ListingChangeDto,
  OkResponseDto,
  SelectOptionDto,
} from "../../src/contracts/common.ts";
import type {
  CatalogRefreshDto,
  DashboardDto,
  SystemStatusDto,
} from "../../src/contracts/dashboard.ts";
import type {
  NotificationDto,
  NotificationListDto,
} from "../../src/contracts/notifications.ts";
import type {
  RecentRunDto,
  RunDto,
  RunWatchResponseDto,
} from "../../src/contracts/runs.ts";
import type {
  CatalogDto,
  RefinementResultDto,
  ResolveWatchRequestDto,
  WatchDraftDto,
  WatchDto,
  WatchListingDto,
} from "../../src/contracts/watches.ts";

export type {
  CatalogDto as Catalog,
  DashboardDto as Dashboard,
  ListingChangeDto as ListingChange,
  NotificationDto as Notification,
  RefinementResultDto as RefinementResult,
  RunDto as Run,
  SelectOptionDto as SelectOption,
  SystemStatusDto as SystemStatus,
  WatchDraftDto as WatchDraft,
  WatchDto as Watch,
  WatchListingDto as WatchListing,
};
export type RunWatchResponse = RunWatchResponseDto;
async function call<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 30_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, { ...init, signal: controller.signal });
    const data = res.status === 204 ? undefined : await res.json();
    if (!res.ok) throw new Error(data?.error || "Request failed");
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
export const dashboard = () => call<DashboardDto>("/api/dashboard");
export const runWatch = (id: string) =>
  call<RunWatchResponseDto>(
    `/api/watches/${id}/run`,
    { method: "POST" },
    125_000,
  );
export const refreshCatalog = () =>
  call<CatalogRefreshDto>("/api/catalog/refresh", {
    method: "POST",
  }, 45_000);
export const notifications = (
  options: { all?: boolean; watchId?: string; type?: string } = {},
) =>
  call<NotificationListDto>(
    `/api/notifications?status=${options.all ? "all" : "unread"}${
      options.watchId ? `&watchId=${encodeURIComponent(options.watchId)}` : ""
    }${options.type ? `&type=${encodeURIComponent(options.type)}` : ""}`,
  );
export const markRead = (id: string) =>
  call<OkResponseDto>(`/api/notifications/${id}/read`, { method: "POST" });
export const markAllRead = (watchId?: string) =>
  call<OkResponseDto>("/api/notifications/mark-all-read", {
    method: "POST",
    headers: watchId ? { "content-type": "application/json" } : undefined,
    body: watchId ? JSON.stringify({ watchId }) : undefined,
  });
export const refreshUnreadCount = () =>
  globalThis.dispatchEvent(new Event("new-parts-count-changed"));

export const catalog = () => call<CatalogDto>("/api/catalog");
export const watches = () => call<WatchDto[]>("/api/watches");
export const watch = (id: string) => call<WatchDto>(`/api/watches/${id}`);
export const resolveWatch = (
  body: ResolveWatchRequestDto,
) =>
  call<RefinementResultDto>("/api/watches/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }, 45_000);
export const saveWatch = (body: WatchDraftDto, id?: string) =>
  call<WatchDto>(id ? `/api/watches/${id}` : "/api/watches", {
    method: id ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
export const deleteWatch = (id: string) =>
  call<void>(`/api/watches/${id}`, { method: "DELETE" });

export const watchListings = (id: string, limit = 500) =>
  call<WatchListingDto[]>(`/api/watches/${id}/listings?limit=${limit}`);
export const watchRuns = (id: string) =>
  call<RunDto[]>(`/api/watches/${id}/runs`);
export const system = () => call<SystemStatusDto>("/api/system");
export const recentRuns = () => call<RecentRunDto[]>("/api/runs");
