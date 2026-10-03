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
import type { SpikeResult } from "../src/types.ts";
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

  Deno.test("integration: executeWatch full cycle with fake runner", async () => {
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

    const fakeResult: SpikeResult = {
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
          sellerUserId: "test-seller-1",
          stockNumber: "STK-999",
          price: { amount: 150, currency: "USD", display: "$150" },
          recycler: { name: "Test Yard" },
        }],
      },
    };

    try {
      // First run (baseline)
      const summary1 = await executeWatch(testWatch.id, {
        runType: "manual",
        searchRunner: () => Promise.resolve(fakeResult),
      });

      assertExists(summary1);
      assertEquals(summary1.status, "succeeded");
      assertEquals(summary1.newListingCount, 1);
      assertEquals(summary1.changedCount, 0);
      assertEquals(summary1.listingCount, 1);

      // Repeat run with same data
      const summary2 = await executeWatch(testWatch.id, {
        runType: "manual",
        searchRunner: () => Promise.resolve(fakeResult),
      });

      assertExists(summary2);
      assertEquals(summary2.status, "succeeded");
      assertEquals(summary2.newListingCount, 0); // Not new anymore!
      assertEquals(summary2.changedCount, 0);

      // Repeat run with modified price
      const modifiedResult: SpikeResult = {
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
      assertEquals(summary3.changedCount, 1); // Detected price update!
    } finally {
      const sql = getDatabase();
      await sql`delete from notification_events where watch_id=${testWatch.id}`;
      await sql`delete from search_runs where watch_id=${testWatch.id}`;
      await sql`delete from watch_listings where watch_id=${testWatch.id}`;
      await sql`delete from watches where id=${testWatch.id}`;
    }
  });
}
