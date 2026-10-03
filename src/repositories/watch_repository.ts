import { getDatabase } from "../db/database.ts";
import type { CarPartSearchRequest } from "../types.ts";
export interface Watch extends CarPartSearchRequest {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  scheduleEnabled: boolean;
  runFrequency: 1 | 2 | 3;
  notifyOnInitialRun: boolean;
}

interface WatchRow {
  id: string;
  name: string;
  enabled: boolean;
  year: string;
  make_model: string;
  part: string;
  location?: string | null;
  sort: CarPartSearchRequest["sort"];
  postal_code?: string | null;
  refinement_label?: string | null;
  created_at: Date;
  updated_at: Date;
  schedule_enabled?: boolean;
  run_frequency?: number;
  notify_on_initial_run?: boolean;
}

const map = (row: WatchRow): Watch => ({
  id: row.id,
  name: row.name,
  enabled: row.enabled,
  year: row.year,
  makeModel: row.make_model,
  part: row.part,
  location: row.location ?? undefined,
  sort: row.sort,
  postalCode: row.postal_code ?? undefined,
  refinement: row.refinement_label
    ? { label: row.refinement_label }
    : undefined,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  scheduleEnabled: row.schedule_enabled ?? true,
  runFrequency: (row.run_frequency ?? 1) as 1 | 2 | 3,
  notifyOnInitialRun: row.notify_on_initial_run ?? false,
});
export async function listWatches() {
  const rows =
    await getDatabase()`select * from watches order by created_at desc`;
  return rows.map((r) => map(r as unknown as WatchRow));
}
export async function getWatch(id: string) {
  const rows = await getDatabase()`select * from watches where id = ${id}`;
  const row = rows[0] as unknown as WatchRow | undefined;
  return row ? map(row) : undefined;
}
export async function saveWatch(watch: Watch) {
  const sql = getDatabase();
  await sql`insert into watches (id,name,enabled,year,make_model,part,location,sort,postal_code,refinement_label,schedule_enabled,run_frequency,notify_on_initial_run) values (${watch.id},${watch.name},${watch.enabled},${watch.year},${watch.makeModel},${watch.part},${
    watch.location ?? null
  },${watch.sort},${watch.postalCode ?? null},${
    watch.refinement?.label ?? null
  },${watch.scheduleEnabled},${watch.runFrequency},${watch.notifyOnInitialRun}) on conflict (id) do update set name=excluded.name,enabled=excluded.enabled,year=excluded.year,make_model=excluded.make_model,part=excluded.part,location=excluded.location,sort=excluded.sort,postal_code=excluded.postal_code,refinement_label=excluded.refinement_label,schedule_enabled=excluded.schedule_enabled,run_frequency=excluded.run_frequency,notify_on_initial_run=excluded.notify_on_initial_run,updated_at=now()`;
  return await getWatch(watch.id);
}
export async function listScheduledWatches(
  slot: "morning" | "afternoon" | "evening",
) {
  const minimumFrequency = slot === "morning"
    ? 1
    : slot === "afternoon"
    ? 3
    : 2;
  const rows =
    await getDatabase()`select * from watches where enabled=true and schedule_enabled=true and run_frequency >= ${minimumFrequency} order by created_at`;
  return rows.map((r) => map(r as unknown as WatchRow));
}
export async function deleteWatch(id: string) {
  return (await getDatabase()`delete from watches where id = ${id}`).count > 0;
}
