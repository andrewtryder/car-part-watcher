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
import { getDatabase } from "../src/db/database.ts";
import { saveWatch, type Watch } from "../src/repositories/watch_repository.ts";

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
  Deno.test("integration: executeWatch throws for non-existent watch", async () => {
    await assertRejects(
      () => executeWatch("00000000-0000-0000-0000-000000000000"),
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
      const summary = await executeWatch(testWatch.id, {
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
      const summary1 = await executeWatch(testWatch.id, {
        runType: "manual",
        searchRunner: () => Promise.resolve(fakeResult),
      });

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
      const summary2 = await executeWatch(testWatch.id, {
        runType: "manual",
        searchRunner: () => Promise.resolve(fakeResult),
      });

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

      const summary3 = await executeWatch(testWatch.id, {
        runType: "manual",
        searchRunner: () => Promise.resolve(modifiedResult),
      });

      assertExists(summary3);
      assertEquals(summary3.status, "succeeded");
      assertEquals(summary3.newListingCount, 0);
      assertEquals(summary3.changedCount, 1); // Detected price update

      // Verify listing_updated event was created in outbox
      const updateEvents = await sql`
        select * from notification_events
        where watch_id = ${testWatch.id} and event_type = 'listing_updated'
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

      const summary4 = await executeWatch(testWatch.id, {
        runType: "manual",
        searchRunner: () => Promise.resolve(modifiedResult2),
        notificationPolicy: { notifyUpdatedListings: false },
      });

      assertExists(summary4);
      assertEquals(summary4.changedCount, 1);
      // No additional update event added
      const updateEventsAfterPolicy = await sql`
        select * from notification_events
        where watch_id = ${testWatch.id} and event_type = 'listing_updated'
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
      const summary = await executeWatch(testWatch.id, {
        runType: "manual",
        searchRunner: () => Promise.resolve(fakeResult),
      });

      assertExists(summary);
      assertEquals(summary.newListingCount, 1);

      // Verify new_listing event is created on initial run
      const events = await sql`
        select * from notification_events
        where watch_id = ${testWatch.id} and event_type = 'new_listing'
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
      await executeWatch(testWatch.id, {
        runType: "scheduled",
        scheduledKey,
        searchRunner: () => Promise.resolve(fakeResult),
      }).catch(() => undefined); // throws because unique.size === 0

      // Second attempt with exact same scheduledKey should immediately return undefined without starting a new run
      const res2 = await executeWatch(testWatch.id, {
        runType: "scheduled",
        scheduledKey,
        searchRunner: () => Promise.resolve(fakeResult),
      });
      assertEquals(res2, undefined);
    } finally {
      await sql`delete from search_runs where watch_id=${testWatch.id}`;
      await sql`delete from watches where id=${testWatch.id}`;
    }
  });
}
