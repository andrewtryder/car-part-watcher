import type { RecentRunDto } from "./runs.ts";
import type { DashboardWatchDto } from "./watches.ts";

export interface DashboardDto {
  timezone: string;
  summary: {
    activeWatchCount: number;
    disabledWatchCount: number;
    newPartCount: number;
    pendingNotificationCount: number;
    failedNotificationCount: number;
    failingWatchCount: number;
    lastRunAt?: string;
    lastRunStatus?: string;
  };
  catalog?: {
    fetchedAt: string;
    yearCount: number;
    makeModelCount: number;
    partCount: number;
  };
  watches: DashboardWatchDto[];
  failingWatches: Array<Pick<DashboardWatchDto, "id" | "name" | "health">>;
  recentRuns: RecentRunDto[];
}

export interface CatalogRefreshDto {
  ok: true;
  fetchedAt: string;
  counts: Record<string, number>;
}

export interface SystemStatusDto {
  timezone: string;
  notifications?: Record<string, number>;
}
