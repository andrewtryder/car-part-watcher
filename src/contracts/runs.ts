export type RunStatusDto = "running" | "succeeded" | "failed";
export type RunTypeDto = "manual" | "scheduled";

export interface RunDto {
  id: string;
  status: RunStatusDto;
  runType?: RunTypeDto;
  startedAt?: string;
  completedAt?: string;
  listingCount?: number;
  newListingCount?: number;
  changedCount?: number;
  pagesFetched?: number;
  errorCode?: string;
  errorMessage?: string;
  skipped?: true;
}

export interface RecentRunDto extends RunDto {
  watchId: string;
  watchName: string;
}

export interface WatchRunSummaryDto {
  runId: string;
  status: "succeeded";
  pagesFetched: number;
  listingCount: number;
  newListingCount: number;
  changedCount: number;
  durationMs: number;
  newListings: Array<{
    year?: string;
    makeModel?: string;
    part?: string;
    description?: string;
    grade?: string;
    stockNumber?: string;
    priceDisplay?: string;
    recyclerName?: string;
    recyclerLocation?: string;
  }>;
}

export type RunWatchResponseDto = WatchRunSummaryDto | { skipped: true };
