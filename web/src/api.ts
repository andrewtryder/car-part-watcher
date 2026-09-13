export type Run = {
  id: string;
  status: "succeeded" | "failed" | "running";
  runType?: "manual" | "scheduled";
  startedAt?: string;
  completedAt?: string;
  listingCount?: number;
  newListingCount?: number;
  changedCount?: number;
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
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
