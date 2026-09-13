import { sourceKey } from "./identity.ts";
import type { PartsSource } from "./parts_source.ts";
import type { CarPartListing, CarPartSearchRequest } from "./types.ts";

export interface Watch {
  id: string;
  name: string;
  enabled: boolean;
  source: "car-part";
  request: CarPartSearchRequest;
  createdAt: string;
  updatedAt: string;
}

export interface Listing {
  id: string;
  source: "car-part";
  sourceKey: string;
  listing: CarPartListing;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface WatchListing {
  watchId: string;
  listingId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSearchRunId: string;
}

export interface SearchRun {
  id: string;
  watchId: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "complete" | "failed";
  listingCount?: number;
  newForWatch?: number;
  updatedListings?: number;
  error?: { code: string; message: string };
}

export interface RunSummary {
  run: SearchRun;
  resultCount: number;
  newForWatch: number;
  updatedListings: number;
  newListings: CarPartListing[];
}

function now() {
  return new Date().toISOString();
}

function errorBody(error: unknown) {
  if (error instanceof Error && "code" in error) {
    return { code: String(error.code), message: error.message };
  }
  return { code: "SEARCH_FAILED", message: "Source search failed" };
}

/** Deno KV persistence for watches and their stable source listings. */
export class WatchStore {
  constructor(private readonly kv: Deno.Kv) {}

  async createWatch(
    request: CarPartSearchRequest,
    options: { name?: string; enabled?: boolean } = {},
  ): Promise<Watch> {
    const createdAt = now();
    const watch: Watch = {
      id: crypto.randomUUID(),
      name: options.name ??
        `${request.year} ${request.makeModel} ${request.part}`,
      enabled: options.enabled ?? true,
      source: "car-part",
      request,
      createdAt,
      updatedAt: createdAt,
    };
    await this.kv.set(["watches", watch.id], watch);
    return watch;
  }

  async getWatch(id: string): Promise<Watch | undefined> {
    return (await this.kv.get<Watch>(["watches", id])).value ?? undefined;
  }

  async getRun(id: string): Promise<SearchRun | undefined> {
    return (await this.kv.get<SearchRun>(["search_runs", id])).value ??
      undefined;
  }

  async getListing(sourceKeyValue: string): Promise<Listing | undefined> {
    return (await this.kv.get<Listing>([
      "listings",
      "car-part",
      sourceKeyValue,
    ]))
      .value ?? undefined;
  }

  async getWatchListing(
    watchId: string,
    listingId: string,
  ): Promise<WatchListing | undefined> {
    return (await this.kv.get<WatchListing>([
      "watch_listings",
      watchId,
      listingId,
    ])).value ?? undefined;
  }

  async runWatch(watch: Watch, source: PartsSource): Promise<RunSummary> {
    const run: SearchRun = {
      id: crypto.randomUUID(),
      watchId: watch.id,
      startedAt: now(),
      status: "running",
    };
    await this.kv.set(["search_runs", run.id], run);

    let result;
    try {
      // This is deliberately before every listing write: a failed worker result
      // cannot create associations or alter last-seen timestamps.
      result = await source.search(watch.request);
    } catch (error) {
      const failed: SearchRun = {
        ...run,
        completedAt: now(),
        status: "failed",
        error: errorBody(error),
      };
      await this.kv.set(["search_runs", run.id], failed);
      throw error;
    }

    const observedAt = now();
    let newForWatch = 0;
    let updatedListings = 0;
    const newListings: CarPartListing[] = [];
    for (const rawListing of result.results.listings) {
      const stableKey = await sourceKey(rawListing);
      if (!stableKey) continue;
      const listingKey: Deno.KvKey = ["listings", "car-part", stableKey];
      const existing = (await this.kv.get<Listing>(listingKey)).value;
      const listing: Listing = existing
        ? {
          ...existing,
          listing: rawListing,
          lastSeenAt: observedAt,
        }
        : {
          id: `car-part:${stableKey}`,
          source: "car-part",
          sourceKey: stableKey,
          listing: rawListing,
          firstSeenAt: observedAt,
          lastSeenAt: observedAt,
        };
      if (existing) updatedListings++;
      await this.kv.set(listingKey, listing);

      const associationKey: Deno.KvKey = [
        "watch_listings",
        watch.id,
        listing.id,
      ];
      const association =
        (await this.kv.get<WatchListing>(associationKey)).value;
      if (!association) {
        newForWatch++;
        newListings.push(rawListing);
      }
      await this.kv.set(
        associationKey,
        {
          watchId: watch.id,
          listingId: listing.id,
          firstSeenAt: association?.firstSeenAt ?? observedAt,
          lastSeenAt: observedAt,
          lastSearchRunId: run.id,
        } satisfies WatchListing,
      );
    }

    const complete: SearchRun = {
      ...run,
      completedAt: now(),
      status: "complete",
      listingCount: result.results.count,
      newForWatch,
      updatedListings,
    };
    await this.kv.set(["search_runs", run.id], complete);
    return {
      run: complete,
      resultCount: result.results.count,
      newForWatch,
      updatedListings,
      newListings,
    };
  }
}
