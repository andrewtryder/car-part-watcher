import { getDatabase } from "../db/database.ts";
import type { CarPartSearchRequest } from "../types.ts";
export interface Watch extends CarPartSearchRequest {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
const map = (row: any): Watch => ({
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
});
export async function listWatches() {
  return (await getDatabase()`select * from watches order by created_at desc`)
    .map(map);
}
export async function getWatch(id: string) {
  const row = (await getDatabase()`select * from watches where id = ${id}`)[0];
  return row && map(row);
}
export async function saveWatch(watch: Watch) {
  const sql = getDatabase();
  await sql`insert into watches (id,name,enabled,year,make_model,part,location,sort,postal_code,refinement_label) values (${watch.id},${watch.name},${watch.enabled},${watch.year},${watch.makeModel},${watch.part},${
    watch.location ?? null
  },${watch.sort},${watch.postalCode ?? null},${
    watch.refinement?.label ?? null
  }) on conflict (id) do update set name=excluded.name,enabled=excluded.enabled,year=excluded.year,make_model=excluded.make_model,part=excluded.part,location=excluded.location,sort=excluded.sort,postal_code=excluded.postal_code,refinement_label=excluded.refinement_label,updated_at=now()`;
  return await getWatch(watch.id);
}
export async function deleteWatch(id: string) {
  return (await getDatabase()`delete from watches where id = ${id}`).count > 0;
}
