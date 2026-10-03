import type { ListingChangeDto, SelectOptionDto } from "./common.ts";
import type { RunDto } from "./runs.ts";

export interface CatalogDto {
  source?: string;
  fetchedAt: string;
  years: SelectOptionDto[];
  makeModels: SelectOptionDto[];
  parts: SelectOptionDto[];
  locations: SelectOptionDto[];
  sorts: SelectOptionDto[];
}

export interface WatchDto {
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
  createdAt: string;
  updatedAt: string;
  health: WatchHealthDto;
}

export type WatchHealthStatus = "healthy" | "failing" | "never_run";

export interface WatchHealthDto {
  status: WatchHealthStatus;
  latestRunStatus?: RunDto["status"];
  latestScheduledRunStatus?: RunDto["status"];
  lastSuccessfulAt?: string;
  lastScheduledRunAt?: string;
  lastFailureAt?: string;
  lastFailureCode?: string;
  lastFailureMessage?: string;
  consecutiveScheduledFailures: number;
}

export type WatchDraftDto =
  & Omit<
    WatchDto,
    "id" | "createdAt" | "updatedAt" | "refinement" | "health"
  >
  & { refinementLabel?: string };

export type ResolveWatchRequestDto = Pick<
  WatchDraftDto,
  | "year"
  | "makeModel"
  | "part"
  | "location"
  | "sort"
  | "postalCode"
  | "refinementLabel"
>;

export type RefinementResultDto =
  | { status: "ready" }
  | { status: "refinement_required"; choices: Array<{ label: string }> };

export interface WatchListingDto {
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
  changes?: ListingChangeDto[];
}

export interface DashboardWatchDto {
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
  lastRun?: RunDto;
  health: WatchHealthDto;
}
