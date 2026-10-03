import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "jsr:@std/assert@1.0.19";
import {
  deduplicateNormalized,
  ListingIdentityCollisionError,
} from "../src/reconciliation.ts";
import { executeWatch } from "../src/services/reconciliation_service.ts";
import type { NormalizedListing } from "../src/listing_normalizer.ts";
import type { CarPartSearchResult } from "../src/types.ts";
import type { CarPartSearchClient } from "../src/search/car_part_search_client.ts";
import { getDatabase } from "../src/db/database.ts";
import { saveWatch, type Watch } from "../src/repositories/watch_repository.ts";
import { listWatchHealth } from "../src/repositories/watch_health_repository.ts";
import { getDashboard } from "../src/services/dashboard_service.ts";

const sampleListing1: NormalizedListing = {
  source: "car-part",
  sourceKey: "seller1|stk100|2015|honda accord|alternator",
  identityMethod: "seller_stock_vehicle_part",
  year: "2015",
  makeModel: "Honda Accord",
  part: "Alternator",
  sellerUserId: "seller1",
  stockNumber: "stk100",
  priceAmount: 107,
  priceDisplay: "$107",
  recyclerName: "Sample Recycler",
  raw: {
    year: "2015",
    makeModel: "Honda Accord",
    part: "Alternator",
    stockNumber: "stk100",
  },
};

const sampleListing2: NormalizedListing = {
  source: "car-part",
  sourceKey: "seller2|stk200|2016|toyota camry|starter",
  identityMethod: "seller_stock_vehicle_part",
  year: "2016",
  makeModel: "Toyota Camry",
  part: "Starter",
  sellerUserId: "seller2",
  stockNumber: "stk200",
  priceAmount: 85,
  priceDisplay: "$85",
  recyclerName: "Another Recycler",
  raw: {
    year: "2016",
    makeModel: "Toyota Camry",
    part: "Starter",
    stockNumber: "stk200",
  },
};

function fakeSearchClient(
  result?: CarPartSearchResult,
): CarPartSearchClient {
  return {
    search: () =>
      result
        ? Promise.resolve(result)
        : Promise.reject(new Error("Search should not run")),
    resolveRefinement: () => Promise.resolve({ status: "ready" }),
    loadCatalog: () =>
      Promise.resolve({
        years: [],
        makeModels: [],
        parts: [],
        locations: [],
        sorts: [],
      }),
  };
}

Deno.test("deduplicateNormalized keeps distinct listings", () => {
  const result = deduplicateNormalized([sampleListing1, sampleListing2]);
  assertEquals(result.length, 2);
  assertEquals(result[0].sourceKey, sampleListing1.sourceKey);
  assertEquals(result[1].sourceKey, sampleListing2.sourceKey);
});

Deno.test("deduplicateNormalized deduplicates identical rows sharing sourceKey", () => {
  const duplicate = { ...sampleListing1 };
  const result = deduplicateNormalized([sampleListing1, duplicate]);
  assertEquals(result.length, 1);
  assertEquals(result[0].sourceKey, sampleListing1.sourceKey);
});

Deno.test("deduplicateNormalized throws ListingIdentityCollisionError on visible signature collision", () => {
  const colliding: NormalizedListing = {
    ...sampleListing1,
    year: "2018", // different vehicle signature with same sourceKey
  };
  const err = assertThrows(
    () => deduplicateNormalized([sampleListing1, colliding]),
    ListingIdentityCollisionError,
  );
  assertEquals(err.code, "LISTING_IDENTITY_COLLISION");
});

// Database-backed integration tests (active when DATABASE_URL is accessible)
const hasEnv =
  (await Deno.permissions.query({ name: "env", variable: "DATABASE_URL" }))
    .state === "granted";
const databaseUrl = hasEnv ? Deno.env.get("DATABASE_URL") : undefined;

if (databaseUrl) {
  Deno.test("integration: watch health derives scheduled failures without manual resets", async () => {
    const makeWatch = (name: string): Watch => ({
      id: crypto.randomUUID(),
      name,
      enabled: true,
      year: "2015",
      makeModel: "Honda Accord",
      part: "Alternator",
      sort: "price",
      scheduleEnabled: true,
      runFrequency: 1,
      notifyOnInitialRun: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const failing = makeWatch("Health failing watch");
    const healthy = makeWatch("Health healthy watch");
    const neverRun = makeWatch("Health never-run watch");
    const sql = getDatabase();
    const addRun = async (
      watchId: string,
      startedAt: string,
      runType: "manual" | "scheduled",
      status: "running" | "succeeded" | "failed",
      errorCode?: string,
    ) => {
      await sql`insert into search_runs (id,watch_id,status,started_at,completed_at,run_type,error_code,error_message) values (${crypto.randomUUID()},${watchId},${status},${new Date(
        startedAt,
      )},${status === "running" ? null : new Date(startedAt)},${runType},${
        errorCode ?? null
      },${errorCode ? "Safe failure detail" : null})`;
    };
    await Promise.all([
      saveWatch(failing),
      saveWatch(healthy),
      saveWatch(neverRun),
    ]);
    try {
      await addRun(
        failing.id,
        "2026-01-01T00:00:00Z",
        "scheduled",
        "succeeded",
      );
      await addRun(
        failing.id,
        "2026-01-02T00:00:00Z",
        "scheduled",
        "failed",
        "REMOTE_BROWSER_DISCONNECTED",
      );
      await addRun(failing.id, "2026-01-03T00:00:00Z", "manual", "succeeded");
      await addRun(
        failing.id,
        "2026-01-04T00:00:00Z",
        "scheduled",
        "failed",
        "ACCESS_CHALLENGE",
      );
      await addRun(failing.id, "2026-01-05T00:00:00Z", "scheduled", "running");
      await addRun(
        healthy.id,
        "2026-01-01T00:00:00Z",
        "scheduled",
        "failed",
        "RUN_TIMEOUT",
      );
      await addRun(
        healthy.id,
        "2026-01-02T00:00:00Z",
        "scheduled",
        "succeeded",
      );

      const health = await listWatchHealth();
      assertEquals(health.get(failing.id), {
        status: "failing",
        latestRunStatus: "running",
        latestScheduledRunStatus: "running",
        lastSuccessfulAt: "2026-01-03T00:00:00.000Z",
        lastScheduledRunAt: "2026-01-05T00:00:00.000Z",
        lastFailureAt: "2026-01-04T00:00:00.000Z",
        lastFailureCode: "ACCESS_CHALLENGE",
        lastFailureMessage: "Safe failure detail",
        consecutiveScheduledFailures: 2,
      });
      assertEquals(health.get(healthy.id)?.status, "healthy");
      assertEquals(health.get(healthy.id)?.consecutiveScheduledFailures, 0);
      assertEquals(health.get(neverRun.id)?.status, "never_run");
      assertEquals(
        health.get(neverRun.id)?.consecutiveScheduledFailures,
        0,
      );
      const dashboard = await getDashboard();
      assertEquals(
        dashboard.failingWatches.some((watch) => watch.id === failing.id),
        true,
      );
      assertEquals(dashboard.summary.failingWatchCount >= 1, true);
    } finally {
      await sql`delete from watches where id in (${failing.id},${healthy.id},${neverRun.id})`;
    }
  });

  Deno.test("integration: executeWatch throws for non-existent watch", async () => {
    await assertRejects(
      () =>
        executeWatch(
          fakeSearchClient(),
          "00000000-0000-0000-0000-000000000000",
        ),
      Error,
      "Watch not found",
    );
  });

  Deno.test("integration: executeWatch disabled watch returns undefined on scheduled run", async () => {
    const testWatch: Watch = {
      id: crypto.randomUUID(),
      name: "Disabled Watch Test",
      enabled: false,
      year: "2015",
      makeModel: "Honda Accord",
      part: "Alternator",
      sort: "price",
      scheduleEnabled: false,
      runFrequency: 1,
      notifyOnInitialRun: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveWatch(testWatch);
    try {
      const summary = await executeWatch(fakeSearchClient(), testWatch.id, {
        runType: "scheduled",
        scheduledKey: `watch:${testWatch.id}:test`,
      });
      assertEquals(summary, undefined);
    } finally {
      const sql = getDatabase();
      await sql`delete from watches where id=${testWatch.id}`;
    }
  });

  Deno.test("integration: executeWatch full cycle with outbox atomicity and updates", async () => {
    const testSeller = `test-seller-${crypto.randomUUID().slice(0, 8)}`;
    const testStock = `STK-${crypto.randomUUID().slice(0, 8)}`;
    const testWatch: Watch = {
      id: crypto.randomUUID(),
      name: "Reconciliation Service Test",
      enabled: true,
      year: "2015",
      makeModel: "Honda Accord",
      part: "Alternator",
      sort: "price",
      scheduleEnabled: true,
      runFrequency: 1,
      notifyOnInitialRun: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveWatch(testWatch);

    const fakeResult: CarPartSearchResult = {
      search: {
        year: "2015",
        makeModel: "Honda Accord",
        part: "Alternator",
        sort: "price",
      },
      results: {
        count: 1,
        hasNextPage: false,
        pagesFetched: 1,
        listings: [{
          year: "2015",
          makeModel: "Honda Accord",
          part: "Alternator",
          sellerUserId: testSeller,
          stockNumber: testStock,
          price: { amount: 150, currency: "USD", display: "$150" },
          recycler: { name: "Test Yard" },
        }],
      },
    };

    const sql = getDatabase();
    try {
      // First run (baseline - notifyOnInitialRun=false)
      const summary1 = await executeWatch(
        fakeSearchClient(fakeResult),
        testWatch.id,
        {
          runType: "manual",
        },
      );

      assertExists(summary1);
      assertEquals(summary1.status, "succeeded");
      assertEquals(summary1.newListingCount, 1);
      assertEquals(summary1.changedCount, 0);
      assertEquals(summary1.listingCount, 1);

      // Verify baseline notification suppression (0 events created)
      const baselineEvents = await sql`
        select * from notification_events where watch_id = ${testWatch.id}
      `;
      assertEquals(baselineEvents.length, 0);

      // Repeat run with same data
      const summary2 = await executeWatch(
        fakeSearchClient(fakeResult),
        testWatch.id,
        {
          runType: "manual",
        },
      );

      assertExists(summary2);
      assertEquals(summary2.status, "succeeded");
      assertEquals(summary2.newListingCount, 0); // Not new anymore
      assertEquals(summary2.changedCount, 0);

      // Repeat run with modified price -> triggers listing_updated event
      const modifiedResult: CarPartSearchResult = {
        ...fakeResult,
        results: {
          ...fakeResult.results,
          listings: [{
            ...fakeResult.results.listings[0],
            price: { amount: 175, currency: "USD", display: "$175" },
          }],
        },
      };

      const summary3 = await executeWatch(
        fakeSearchClient(modifiedResult),
        testWatch.id,
        {
          runType: "manual",
        },
      );

      assertExists(summary3);
      assertEquals(summary3.status, "succeeded");
      assertEquals(summary3.newListingCount, 0);
      assertEquals(summary3.changedCount, 1); // Detected price update

      // Verify listing_updated event was created in outbox
      const updateEvents = await sql`
        select e.*, d.status, d.processed_at from notification_events e join notification_deliveries d on d.event_id=e.id
        where e.watch_id = ${testWatch.id} and e.event_type = 'listing_updated'
      `;
      assertEquals(updateEvents.length, 1);
      assertEquals(updateEvents[0].status, "delivered");
      assertExists(updateEvents[0].processed_at);

      // Verify delivery policy: suppressing updated listings
      const modifiedResult2: CarPartSearchResult = {
        ...fakeResult,
        results: {
          ...fakeResult.results,
          listings: [{
            ...fakeResult.results.listings[0],
            price: { amount: 200, currency: "USD", display: "$200" },
          }],
        },
      };

      const summary4 = await executeWatch(
        fakeSearchClient(modifiedResult2),
        testWatch.id,
        {
          runType: "manual",
          notificationPolicy: { notifyUpdatedListings: false },
        },
      );

      assertExists(summary4);
      assertEquals(summary4.changedCount, 1);
      // No additional update event added
      const updateEventsAfterPolicy = await sql`
        select e.*, d.status, d.processed_at from notification_events e join notification_deliveries d on d.event_id=e.id
        where e.watch_id = ${testWatch.id} and e.event_type = 'listing_updated'
      `;
      assertEquals(updateEventsAfterPolicy.length, 1);
    } finally {
      await sql`delete from notification_events where watch_id=${testWatch.id}`;
      await sql`delete from listing_changes where watch_id=${testWatch.id}`;
      await sql`delete from search_runs where watch_id=${testWatch.id}`;
      await sql`delete from watch_listings where watch_id=${testWatch.id}`;
      await sql`delete from watches where id=${testWatch.id}`;
      await sql`delete from listings where seller_user_id=${testSeller}`;
    }
  });

  Deno.test("integration: executeWatch with notifyOnInitialRun=true creates outbox event", async () => {
    const testSeller = `test-seller-${crypto.randomUUID().slice(0, 8)}`;
    const testStock = `STK-${crypto.randomUUID().slice(0, 8)}`;
    const testWatch: Watch = {
      id: crypto.randomUUID(),
      name: "Initial Notify Test",
      enabled: true,
      year: "2015",
      makeModel: "Honda Accord",
      part: "Alternator",
      sort: "price",
      scheduleEnabled: true,
      runFrequency: 1,
      notifyOnInitialRun: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveWatch(testWatch);

    const fakeResult: CarPartSearchResult = {
      search: {
        year: "2015",
        makeModel: "Honda Accord",
        part: "Alternator",
        sort: "price",
      },
      results: {
        count: 1,
        hasNextPage: false,
        pagesFetched: 1,
        listings: [{
          year: "2015",
          makeModel: "Honda Accord",
          part: "Alternator",
          sellerUserId: testSeller,
          stockNumber: testStock,
          price: { amount: 120, currency: "USD", display: "$120" },
          recycler: { name: "Test Yard" },
        }],
      },
    };

    const sql = getDatabase();
    try {
      const summary = await executeWatch(
        fakeSearchClient(fakeResult),
        testWatch.id,
        {
          runType: "manual",
        },
      );

      assertExists(summary);
      assertEquals(summary.newListingCount, 1);

      // Verify new_listing event is created on initial run
      const events = await sql`
        select e.*, d.status, d.processed_at from notification_events e join notification_deliveries d on d.event_id=e.id
        where e.watch_id = ${testWatch.id} and e.event_type = 'new_listing'
      `;
      assertEquals(events.length, 1);
      assertEquals(events[0].status, "delivered");
      assertExists(events[0].processed_at);
    } finally {
      await sql`delete from notification_events where watch_id=${testWatch.id}`;
      await sql`delete from listing_changes where watch_id=${testWatch.id}`;
      await sql`delete from search_runs where watch_id=${testWatch.id}`;
      await sql`delete from watch_listings where watch_id=${testWatch.id}`;
      await sql`delete from watches where id=${testWatch.id}`;
      await sql`delete from listings where seller_user_id=${testSeller}`;
    }
  });

  Deno.test("integration: executeWatch duplicate scheduledKey returns undefined", async () => {
    const testWatch: Watch = {
      id: crypto.randomUUID(),
      name: "Scheduled Key Dedup Test",
      enabled: true,
      year: "2015",
      makeModel: "Honda Accord",
      part: "Alternator",
      sort: "price",
      scheduleEnabled: true,
      runFrequency: 1,
      notifyOnInitialRun: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveWatch(testWatch);

    const fakeResult: CarPartSearchResult = {
      search: {
        year: "2015",
        makeModel: "Honda Accord",
        part: "Alternator",
        sort: "price",
      },
      results: {
        count: 0,
        hasNextPage: false,
        pagesFetched: 1,
        listings: [],
      },
    };

    const scheduledKey = `watch:${testWatch.id}:slot-${crypto.randomUUID()}`;
    const sql = getDatabase();
    try {
      // First attempt with scheduledKey starts a run (will fail search since listings empty, but run is recorded)
      await executeWatch(fakeSearchClient(fakeResult), testWatch.id, {
        runType: "scheduled",
        scheduledKey,
      }).catch(() => undefined); // throws because unique.size === 0

      // Second attempt with exact same scheduledKey should immediately return undefined without starting a new run
      const res2 = await executeWatch(
        fakeSearchClient(fakeResult),
        testWatch.id,
        {
          runType: "scheduled",
          scheduledKey,
        },
      );
      assertEquals(res2, undefined);
    } finally {
      await sql`delete from search_runs where watch_id=${testWatch.id}`;
      await sql`delete from watches where id=${testWatch.id}`;
    }
  });
}
