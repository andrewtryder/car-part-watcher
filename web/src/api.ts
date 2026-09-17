export type Run = {
  id: string;
  status: "succeeded" | "failed" | "running";
  runType?: "manual" | "scheduled";
  startedAt?: string;
  completedAt?: string;
  listingCount?: number;
  newListingCount?: number;
  changedCount?: number;
  pagesFetched?: number;
  errorCode?: string;
  errorMessage?: string;
};
export type Dashboard = {
  timezone: string;
  summary: {
    activeWatchCount: number;
    newPartCount: number;
    pendingNotificationCount: number;
    failedNotificationCount: number;
    lastRunAt?: string;
    lastRunStatus?: string;
  };
  catalog?: {
    fetchedAt: string;
    yearCount: number;
    makeModelCount: number;
    partCount: number;
  };
  watches: Array<
    {
      id: string;
      name: string;
      enabled: boolean;
      criteria: {
        year: string;
        makeModel: string;
        part: string;
        location?: string;
        refinementLabel?: string;
      };
      schedule: { enabled: boolean; frequency: number };
      lastRun?: Run;
    }
  >;
  recentRuns: Array<Run & { watchId: string; watchName: string }>;
};
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(path, { ...init, signal: controller.signal });
    const data = res.status === 204 ? undefined : await res.json();
    if (!res.ok) throw new Error(data?.error || "Request failed");
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
export const dashboard = () => call<Dashboard>("/api/dashboard");
export const runWatch = (id: string) =>
  call<Run>(`/api/watches/${id}/run`, { method: "POST" });
export const refreshCatalog = () =>
  call<{ counts: Record<string, number> }>("/api/catalog/refresh", {
    method: "POST",
  });
export type ListingChange = {
  field: string;
  oldValue?: string;
  newValue?: string;
};

export type Notification = {
  id: string;
  watchId: string;
  eventType?: "new_listing" | "listing_updated";
  createdAt: string;
  readAt?: string;
  payload: {
    watch: { id: string; name: string };
    listing: {
      id: string;
      title: string;
      price?: string;
      recyclerName?: string;
      location?: string;
      stockNumber?: string;
      description?: string;
      grade?: string;
      damageCode?: string;
      imageUrl?: string;
      photoUrl?: string;
      quoteUrl?: string;
    };
    changes?: ListingChange[];
  };
};
export const notifications = (
  options: { all?: boolean; watchId?: string; type?: string } = {},
) =>
  call<{ items: Notification[]; unreadCount: number }>(
    `/api/notifications?status=${options.all ? "all" : "unread"}${
      options.watchId ? `&watchId=${encodeURIComponent(options.watchId)}` : ""
    }${options.type ? `&type=${encodeURIComponent(options.type)}` : ""}`,
  );
export const markRead = (id: string) =>
  call<{ ok: true }>(`/api/notifications/${id}/read`, { method: "POST" });
export const markAllRead = (watchId?: string) =>
  call<{ ok: true }>("/api/notifications/mark-all-read", {
    method: "POST",
    headers: watchId ? { "content-type": "application/json" } : undefined,
    body: watchId ? JSON.stringify({ watchId }) : undefined,
  });
export const refreshUnreadCount = () =>
  globalThis.dispatchEvent(new Event("new-parts-count-changed"));

export type SelectOption = { label: string; value: string };
export type Catalog = {
  fetchedAt: string;
  years: SelectOption[];
  makeModels: SelectOption[];
  parts: SelectOption[];
  locations: SelectOption[];
  sorts: SelectOption[];
};
export type Watch = {
  id: string;
  name: string;
  enabled: boolean;
  year: string;
  makeModel: string;
  part: string;
  location?: string;
  sort: string;
  postalCode?: string;
  refinement?: { label: string };
  scheduleEnabled: boolean;
  runFrequency: 1 | 2 | 3;
  notifyOnInitialRun: boolean;
};
export type WatchDraft = Omit<Watch, "id" | "refinement"> & {
  refinementLabel?: string;
};
export type RefinementResult = {
  status: "ready" | "refinement_required";
  choices?: Array<{ label: string }>;
};
export const catalog = () => call<Catalog>("/api/catalog");
export const watches = () => call<Watch[]>("/api/watches");
export const watch = (id: string) => call<Watch>(`/api/watches/${id}`);
export const resolveWatch = (
  body: Omit<
    WatchDraft,
    | "name"
    | "enabled"
    | "scheduleEnabled"
    | "runFrequency"
    | "notifyOnInitialRun"
  >,
) =>
  call<RefinementResult>("/api/watches/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
export const saveWatch = (body: WatchDraft, id?: string) =>
  call<Watch>(id ? `/api/watches/${id}` : "/api/watches", {
    method: id ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
export const deleteWatch = (id: string) =>
  call<void>(`/api/watches/${id}`, { method: "DELETE" });

export type WatchListing = {
  id: string;
  year?: string;
  makeModel?: string;
  part?: string;
  description?: string;
  damageCode?: string;
  grade?: string;
  stockNumber?: string;
  priceAmount?: number;
  priceDisplay?: string;
  recyclerName?: string;
  recyclerLocation?: string;
  recyclerPhone?: string;
  imageUrl?: string;
  photoUrl?: string;
  quoteUrl?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  isModified?: boolean;
  changes?: ListingChange[];
};
export type SystemStatus = { timezone: string };
export const watchListings = (id: string, limit = 500) =>
  call<WatchListing[]>(`/api/watches/${id}/listings?limit=${limit}`);
export const watchRuns = (id: string) => call<Run[]>(`/api/watches/${id}/runs`);
export const system = () => call<SystemStatus>("/api/system");
export const recentRuns = () =>
  call<Array<Run & { watchId: string; watchName: string }>>("/api/runs");
