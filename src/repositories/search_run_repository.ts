import { getDatabase } from "../db/database.ts";
import type { Sql } from "./listing_repository.ts";

export interface SearchRun {
  id: string;
  watchId: string;
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  completedAt?: string;
  listingCount?: number;
  newListingCount?: number;
  changedCount?: number;
  pagesFetched?: number;
  errorCode?: string;
  errorMessage?: string;
}
const map = (row: any): SearchRun => ({
  id: row.id,
  watchId: row.watch_id,
  status: row.status,
  startedAt: row.started_at.toISOString(),
  completedAt: row.completed_at?.toISOString(),
  listingCount: row.listing_count ?? undefined,
  newListingCount: row.new_listing_count ?? undefined,
  changedCount: row.changed_count ?? undefined,
  pagesFetched: row.pages_fetched ?? undefined,
  errorCode: row.error_code ?? undefined,
  errorMessage: row.error_message ?? undefined,
});

export async function createSearchRun(
  watchId: string,
  options: { runType?: "manual" | "scheduled"; scheduledKey?: string } = {},
) {
  const id = crypto.randomUUID();
  const startedAt = new Date();
  const rows =
    await getDatabase()`insert into search_runs (id,watch_id,status,started_at,run_type,scheduled_key) values (${id},${watchId},'running',${startedAt},${
      options.runType ?? "manual"
    },${options.scheduledKey ?? null}) on conflict do nothing returning id`;
  return rows.length
    ? {
      id,
      watchId,
      status: "running" as const,
      startedAt: startedAt.toISOString(),
    }
    : undefined;
}
export async function completeSearchRun(
  sql: Sql,
  id: string,
  fields: {
    listingCount: number;
    newListingCount: number;
    changedCount: number;
    pagesFetched: number;
    completedAt: Date;
  },
) {
  await sql`update search_runs set status='succeeded',completed_at=${fields.completedAt},listing_count=${fields.listingCount},new_listing_count=${fields.newListingCount},changed_count=${fields.changedCount},pages_fetched=${fields.pagesFetched} where id=${id}`;
}
export async function failSearchRun(
  id: string,
  errorCode: string,
  errorMessage: string,
) {
  await getDatabase()`update search_runs set status='failed',completed_at=${new Date()},error_code=${errorCode},error_message=${
    errorMessage.slice(0, 500)
  } where id=${id}`;
}
export async function listSearchRuns(watchId: string) {
  return (await getDatabase()`select * from search_runs where watch_id=${watchId} order by started_at desc limit 25`)
    .map(map);
}
export async function listRecentSearchRuns(limit = 50) {
  const rows =
    await getDatabase()`select r.*, w.name as watch_name from search_runs r join watches w on w.id=r.watch_id order by r.started_at desc limit ${
      Math.min(Math.max(limit, 1), 100)
    }`;
  return rows.map((row: any) => ({
    ...map(row),
    watchName: row.watch_name,
    runType: row.run_type,
  }));
}
export async function hasPreviousSuccessfulRun(watchId: string) {
  return Boolean(
    (await getDatabase()`select 1 from search_runs where watch_id=${watchId} and status='succeeded' limit 1`)[
      0
    ],
  );
}
