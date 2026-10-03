import { runCarPartSearch } from "../browser/car_part_browser.ts";
import { BrowserlessBrowserProvider } from "../browser/browserless_browser_provider.ts";
import { getDatabase } from "../db/database.ts";
import {
  type NormalizedListing,
  normalizeListing,
} from "../listing_normalizer.ts";
import {
  associateListing,
  upsertListing,
} from "../repositories/listing_repository.ts";
import {
  completeSearchRun,
  createSearchRun,
  failSearchRun,
  hasPreviousSuccessfulRun,
} from "../repositories/search_run_repository.ts";
import { getWatch, type Watch } from "../repositories/watch_repository.ts";
import { CarPartSearchError, type CarPartSearchResult } from "../types.ts";
import { deduplicateNormalized } from "../reconciliation.ts";
import {
  createListingUpdatedEvent,
  createNewListingEvent,
} from "../repositories/notification_repository.ts";
import {
  buildNotificationEventV1,
  processNotificationOutbox,
} from "./notification_service.ts";
import type { ListingFieldChange } from "../listing_normalizer.ts";
import { executeSearchWithRetry } from "./search_retry.ts";

export interface WatchRunSummary {
  runId: string;
  status: "succeeded";
  pagesFetched: number;
  listingCount: number;
  newListingCount: number;
  changedCount: number;
  durationMs: number;
  newListings: NormalizedListing[];
}

function safeError(error: unknown) {
  if (error instanceof CarPartSearchError) {
    return { code: error.code, message: error.message };
  }
  if (error && typeof error === "object" && "code" in error) {
    return {
      code: String((error as { code: unknown }).code),
      message: error instanceof Error ? error.message : "Search failed",
    };
  }
  return {
    code: "SEARCH_FAILED",
    message: error instanceof Error
      ? error.message.slice(0, 500)
      : "Search failed",
  };
}

export interface NotificationDeliveryPolicy {
  notifyNewListings?: boolean;
  notifyUpdatedListings?: boolean;
}

export interface ExecuteWatchOptions {
  runType?: "manual" | "scheduled";
  scheduledKey?: string;
  scheduleSlot?: string;
  searchRunner?: (watch: Watch) => Promise<CarPartSearchResult>;
  maxAttempts?: number;
  backoffDelaysMs?: number[];
  maxRunTimeMs?: number;
  notificationPolicy?: NotificationDeliveryPolicy;
}

export async function executeWatch(
  watchId: string,
  options: ExecuteWatchOptions = {},
): Promise<WatchRunSummary | undefined> {
  const watch = await getWatch(watchId);
  if (!watch) throw new Error("Watch not found");
  if (!watch.enabled && options.runType === "scheduled") return undefined;
  const hadSuccessfulRun = await hasPreviousSuccessfulRun(watch.id);
  const run = await createSearchRun(watch.id, options);
  if (!run) return undefined;
  const began = performance.now();
  const search = options.searchRunner ??
    ((w) => runCarPartSearch(new BrowserlessBrowserProvider(), w));

  try {
    const result = await executeSearchWithRetry(search, watch, {
      maxAttempts: options.maxAttempts,
      backoffDelaysMs: options.backoffDelaysMs,
      maxRunTimeMs: options.maxRunTimeMs,
    });

    const normalized =
      (await Promise.all(result.results.listings.map(normalizeListing))).filter(
        (item): item is NormalizedListing => Boolean(item),
      );
    const unique = new Map(
      deduplicateNormalized(normalized).map((
        listing,
      ) => [listing.sourceKey, listing]),
    );
    if (!unique.size) {
      throw new Error("No listings had a durable source identity");
    }
    const observedAt = new Date();
    let newListingCount = 0;
    let changedCount = 0;
    const newListings: NormalizedListing[] = [];
    const newEventInputs: { listingId: string; listing: NormalizedListing }[] =
      [];
    const updatedEventInputs: {
      listingId: string;
      listing: NormalizedListing;
      changes: ListingFieldChange[];
    }[] = [];

    const shouldNotify = hadSuccessfulRun || watch.notifyOnInitialRun;
    const scheduleSlot = options.scheduleSlot ??
      (options.runType === "scheduled" && options.scheduledKey
        ? options.scheduledKey.split(":").pop()
        : undefined) ??
      "manual";
    const notifyNew = options.notificationPolicy?.notifyNewListings ?? true;
    const notifyUpdated = options.notificationPolicy?.notifyUpdatedListings ??
      true;

    await getDatabase().begin(async (sql) => {
      for (const listing of unique.values()) {
        const stored = await upsertListing(sql, listing, observedAt, {
          watchId: watch.id,
          runId: run.id,
        });
        if (stored.changedFields.length) {
          changedCount++;
          if (!stored.isNew && stored.changes?.length) {
            updatedEventInputs.push({
              listingId: stored.id,
              listing,
              changes: stored.changes,
            });
          }
        }
        if (
          await associateListing(sql, watch.id, stored.id, run.id, observedAt)
        ) {
          newListingCount++;
          newListings.push(listing);
          newEventInputs.push({ listingId: stored.id, listing });
        }
      }

      if (shouldNotify) {
        if (notifyNew) {
          for (const { listingId, listing } of newEventInputs) {
            const canonicalEvent = buildNotificationEventV1({
              watch: { id: watch.id, name: watch.name },
              listing: { id: listingId, listing },
              scheduleSlot,
            });
            await createNewListingEvent(sql, {
              id: canonicalEvent.eventId,
              watchId: watch.id,
              searchRunId: run.id,
              listingId,
              payload: canonicalEvent,
            });
          }
        }
        if (notifyUpdated) {
          for (const { listingId, listing, changes } of updatedEventInputs) {
            const canonicalEvent = buildNotificationEventV1({
              watch: { id: watch.id, name: watch.name },
              listing: { id: listingId, listing },
              scheduleSlot,
              eventType: "listing_updated",
              changes,
            });
            await createListingUpdatedEvent(sql, {
              id: canonicalEvent.eventId,
              watchId: watch.id,
              searchRunId: run.id,
              listingId,
              payload: canonicalEvent,
            });
          }
        }
      }

      await completeSearchRun(sql, run.id, {
        listingCount: unique.size,
        newListingCount,
        changedCount,
        pagesFetched: result.results.pagesFetched ?? 1,
        completedAt: new Date(),
      });
    });

    if (
      shouldNotify &&
      ((notifyNew && newEventInputs.length > 0) ||
        (notifyUpdated && updatedEventInputs.length > 0))
    ) {
      try {
        await processNotificationOutbox();
      } catch (error) {
        console.error(
          "notification outbox processing failed",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    return {
      runId: run.id,
      status: "succeeded",
      pagesFetched: result.results.pagesFetched ?? 1,
      listingCount: unique.size,
      newListingCount,
      changedCount,
      durationMs: Math.round(performance.now() - began),
      newListings,
    };
  } catch (error) {
    const safe = safeError(error);
    await failSearchRun(run.id, safe.code, safe.message).catch(() => undefined);
    throw error;
  }
}
