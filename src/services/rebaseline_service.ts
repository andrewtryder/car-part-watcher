import { BrowserlessBrowserProvider } from "../browser/browserless_browser_provider.ts";
import { runCarPartSearch } from "../browser/car_part_browser.ts";
import { getDatabase } from "../db/database.ts";
import { normalizeListing, type NormalizedListing } from "../listing_normalizer.ts";
import { deduplicateNormalized } from "../reconciliation.ts";
import { associateListing, upsertListing } from "../repositories/listing_repository.ts";
import { completeSearchRun } from "../repositories/search_run_repository.ts";
import { getWatch } from "../repositories/watch_repository.ts";

export interface RebaselinePlan {
  watchId: string; watchName: string; scheduleEnabled: boolean; runFrequency: number;
  legacyAssociationCount: number; correctedRawCount: number; correctedUniqueCount: number;
  correctedKeyCollisions: number; externalReferences: number; notificationsToCreate: 0;
}

async function correctedListings(watchId: string) {
  const watch = await getWatch(watchId);
  if (!watch) throw new Error("Watch not found");
  const result = await runCarPartSearch(new BrowserlessBrowserProvider(), watch);
  if (result.results.hasNextPage) throw new Error("Search was incomplete: source still exposes a next page");
  const normalized = (await Promise.all(result.results.listings.map(normalizeListing))).filter((item): item is NormalizedListing => Boolean(item));
  const unique = deduplicateNormalized(normalized);
  return { watch, result, unique, collisions: normalized.length - unique.length };
}

export async function planRebaseline(watchId: string): Promise<RebaselinePlan> {
  const { watch, result, unique, collisions } = await correctedListings(watchId);
  const sql = getDatabase();
  const associated = await sql`select listing_id from watch_listings where watch_id=${watch.id}`;
  const external = associated.length
    ? await sql`select count(*)::int as count from watch_listings where listing_id in ${sql(associated.map((row: any) => row.listing_id))} and watch_id<>${watch.id}`
    : [{ count: 0 }];
  return { watchId: watch.id, watchName: watch.name, scheduleEnabled: watch.scheduleEnabled,
    runFrequency: watch.runFrequency, legacyAssociationCount: associated.length,
    correctedRawCount: result.results.count, correctedUniqueCount: unique.length,
    correctedKeyCollisions: collisions, externalReferences: external[0].count,
    notificationsToCreate: 0 };
}

/** Explicit administrative repair. It never uses normal-run notification semantics. */
export async function applyRebaseline(watchId: string): Promise<RebaselinePlan & { runId: string }> {
  const plan = await planRebaseline(watchId);
  if (plan.correctedKeyCollisions || plan.externalReferences) throw new Error("Rebaseline preflight is unsafe");
  const { watch, result, unique } = await correctedListings(watchId);
  const database = getDatabase();
  await database`update watches set schedule_enabled=false where id=${watch.id}`;
  try {
    const runId = crypto.randomUUID(); const observedAt = new Date();
    await database.begin(async (sql) => {
      const legacy = await sql`select listing_id from watch_listings where watch_id=${watch.id}`;
      await sql`insert into search_runs (id,watch_id,status,started_at,run_type) values (${runId},${watch.id},'running',${observedAt},'manual')`;
      await sql`delete from watch_listings where watch_id=${watch.id}`;
      if (legacy.length) await sql`update listings set superseded_at=${observedAt},superseded_reason='legacy_crv_shifted_columns',updated_at=${observedAt} where id in ${sql(legacy.map((row: any) => row.listing_id))}`;
      for (const listing of unique) {
        const stored = await upsertListing(sql, listing, observedAt);
        await associateListing(sql, watch.id, stored.id, runId, observedAt);
      }
      await completeSearchRun(sql, runId, { listingCount: unique.length, newListingCount: 0, changedCount: 0, pagesFetched: result.results.pagesFetched ?? 1, completedAt: new Date() });
    });
    return { ...plan, runId };
  } finally {
    await database`update watches set schedule_enabled=${watch.scheduleEnabled} where id=${watch.id}`;
  }
}
