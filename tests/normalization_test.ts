import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.19";
import {
  detailedMutableChanges,
  mutableChanges,
  normalizeListing,
} from "../src/listing_normalizer.ts";
import {
  deduplicateNormalized,
  ListingIdentityCollisionError,
} from "../src/reconciliation.ts";
import type { CarPartListing } from "../src/types.ts";

const base: CarPartListing = {
  year: "2015",
  makeModel: "Honda Accord",
  part: "Alternator",
  sellerUserId: "77",
  partGuid: "part-guid-a",
  stockNumber: " A-1 ",
  recycler: { name: "Example Recycler" },
  price: { display: "$100", amount: 100, currency: "USD" },
  description: "Original",
  grade: "A",
};

Deno.test("normalization retains identity through mutable changes and reports them", async () => {
  const first = await normalizeListing(base);
  const revised = await normalizeListing({
    ...base,
    price: { display: "$90", amount: 90, currency: "USD" },
    description: "Revised",
    grade: "B",
  });
  assertEquals(first?.sourceKey, revised?.sourceKey);
  assertEquals(mutableChanges(first!, revised!), [
    "description",
    "grade",
    "priceAmount",
    "priceDisplay",
  ]);

  const detailed = detailedMutableChanges(first!, revised!);
  assertEquals(detailed, [
    { field: "priceDisplay", oldValue: "$100", newValue: "$90" },
    { field: "priceAmount", oldValue: "100", newValue: "90" },
    { field: "grade", oldValue: "A", newValue: "B" },
    { field: "description", oldValue: "Original", newValue: "Revised" },
  ]);
});

Deno.test("detailedMutableChanges handles db row snake_case comparisons", async () => {
  const dbRow = {
    price_display: "$100",
    price_amount: 100,
    description: "Original",
    grade: "A",
    damage_code: null,
    stock_number: "A-1",
    recycler_name: "Example Recycler",
  };
  const nextListing = (await normalizeListing({
    ...base,
    price: { display: "$85", amount: 85, currency: "USD" },
    damageCode: "000",
  }))!;

  const detailed = detailedMutableChanges(dbRow, nextListing);
  assertEquals(detailed, [
    { field: "priceDisplay", oldValue: "$100", newValue: "$85" },
    { field: "priceAmount", oldValue: "100", newValue: "85" },
    { field: "damageCode", oldValue: undefined, newValue: "000" },
  ]);
});

Deno.test("normalization skips a listing missing a strong identity component", async () => {
  const listing = await normalizeListing({ ...base, sellerUserId: undefined });
  assertEquals(listing, undefined);
});

Deno.test("duplicate result rows are deduplicated and visibly conflicting rows fail", async () => {
  const listing = (await normalizeListing(base))!;
  assertEquals(deduplicateNormalized([listing, listing]).length, 1);
  assertThrows(() => deduplicateNormalized([listing, { ...listing, year: "2016" }]), ListingIdentityCollisionError);
});
