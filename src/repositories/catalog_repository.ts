import { getDatabase } from "../db/database.ts";
import type { SearchOptions } from "../types.ts";

export interface CatalogRecord {
  source: string;
  payload: SearchOptions;
  fetchedAt: string;
  checksum?: string;
}
export async function getCatalog(): Promise<CatalogRecord | undefined> {
  const rows =
    await getDatabase()`select source, payload, fetched_at, checksum from source_catalogs where source = 'car-part'`;
  const row = rows[0];
  return row &&
    {
      source: row.source,
      payload: row.payload,
      fetchedAt: row.fetched_at.toISOString(),
      checksum: row.checksum ?? undefined,
    };
}
export async function saveCatalog(payload: SearchOptions, checksum: string) {
  const sql = getDatabase();
  await sql`insert into source_catalogs (source, payload, fetched_at, checksum)
    values ('car-part', ${
    sql.json(JSON.parse(JSON.stringify(payload)))
  }, now(), ${checksum})
    on conflict (source) do update set payload = excluded.payload, fetched_at = now(), checksum = excluded.checksum, updated_at = now()`;
  return getCatalog();
}
