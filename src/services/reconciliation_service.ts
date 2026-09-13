import { runCarPartSearch } from "../browser/car_part_browser.ts";
import { BrowserlessBrowserProvider } from "../browser/browserless_browser_provider.ts";
import { getDatabase } from "../db/database.ts";
import { normalizeListing, type NormalizedListing } from "../listing_normalizer.ts";
import { associateListing, upsertListing } from "../repositories/listing_repository.ts";
import { completeSearchRun, createSearchRun, failSearchRun } from "../repositories/search_run_repository.ts";
import { getWatch, type Watch } from "../repositories/watch_repository.ts";
import { SpikeError } from "../types.ts";
import { deduplicateNormalized, ListingIdentityCollisionError } from "../reconciliation.ts";

export interface WatchRunSummary {
  runId: string; status: "succeeded"; pagesFetched: number; listingCount: number;
  newListingCount: number; changedCount: number; durationMs: number;
  newListings: NormalizedListing[];
}


function safeError(error: unknown) {
  if (error instanceof SpikeError) return { code: error.code, message: error.message };
  if (error && typeof error === "object" && "code" in error) return { code: String((error as { code: unknown }).code), message: error instanceof Error ? error.message : "Search failed" };
  return { code: "SEARCH_FAILED", message: error instanceof Error ? error.message.slice(0, 500) : "Search failed" };
}

export async function executeWatch(watchId: string): Promise<WatchRunSummary> {
  const watch = await getWatch(watchId);
  if (!watch) throw new Error("Watch not found");
  if (!watch.enabled) throw new Error("Watch is disabled");
  const run = await createSearchRun(watch.id);
  const began = performance.now();
  try {
    const result = await runCarPartSearch(new BrowserlessBrowserProvider(), watch);
    const normalized = (await Promise.all(result.results.listings.map(normalizeListing))).filter((item): item is NormalizedListing => Boolean(item));
    const unique = new Map(deduplicateNormalized(normalized).map((listing) => [listing.sourceKey, listing]));
    if (!unique.size) throw new Error("No listings had a durable source identity");
    const observedAt = new Date();
    let newListingCount = 0; let changedCount = 0;
    const newListings: NormalizedListing[] = [];
    await getDatabase().begin(async (sql) => {
      for (const listing of unique.values()) {
        const stored = await upsertListing(sql, listing, observedAt);
        if (stored.changedFields.length) changedCount++;
        if (await associateListing(sql, watch.id, stored.id, run.id, observedAt)) {
          newListingCount++; newListings.push(listing);
        }
      }
      await completeSearchRun(sql, run.id, {
        listingCount: unique.size, newListingCount, changedCount,
        pagesFetched: result.results.pagesFetched ?? 1, completedAt: new Date(),
      });
    });
    return { runId: run.id, status: "succeeded", pagesFetched: result.results.pagesFetched ?? 1,
      listingCount: unique.size, newListingCount, changedCount,
      durationMs: Math.round(performance.now() - began), newListings };
  } catch (error) {
    const safe = safeError(error);
    await failSearchRun(run.id, safe.code, safe.message).catch(() => undefined);
    throw error;
  }
}
