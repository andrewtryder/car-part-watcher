import { getDatabase } from "../db/database.ts";
import type { Sql } from "./listing_repository.ts";

export interface SearchRun {
  id: string; watchId: string; status: "running" | "succeeded" | "failed";
  startedAt: string; completedAt?: string; listingCount?: number; newListingCount?: number;
  changedCount?: number; pagesFetched?: number; errorCode?: string; errorMessage?: string;
}
const map = (row: any): SearchRun => ({ id: row.id, watchId: row.watch_id, status: row.status,
  startedAt: row.started_at.toISOString(), completedAt: row.completed_at?.toISOString(),
  listingCount: row.listing_count ?? undefined, newListingCount: row.new_listing_count ?? undefined,
  changedCount: row.changed_count ?? undefined, pagesFetched: row.pages_fetched ?? undefined,
  errorCode: row.error_code ?? undefined, errorMessage: row.error_message ?? undefined });

export async function createSearchRun(watchId: string) {
  const id = crypto.randomUUID(); const startedAt = new Date();
  await getDatabase()`insert into search_runs (id,watch_id,status,started_at) values (${id},${watchId},'running',${startedAt})`;
  return { id, watchId, status: "running" as const, startedAt: startedAt.toISOString() };
}
export async function completeSearchRun(sql: Sql, id: string, fields: { listingCount: number; newListingCount: number; changedCount: number; pagesFetched: number; completedAt: Date }) {
  await sql`update search_runs set status='succeeded',completed_at=${fields.completedAt},listing_count=${fields.listingCount},new_listing_count=${fields.newListingCount},changed_count=${fields.changedCount},pages_fetched=${fields.pagesFetched} where id=${id}`;
}
export async function failSearchRun(id: string, errorCode: string, errorMessage: string) {
  await getDatabase()`update search_runs set status='failed',completed_at=${new Date()},error_code=${errorCode},error_message=${errorMessage.slice(0, 500)} where id=${id}`;
}
export async function listSearchRuns(watchId: string) {
  return (await getDatabase()`select * from search_runs where watch_id=${watchId} order by started_at desc limit 25`).map(map);
}
