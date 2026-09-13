import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.19";
import { normalizeListing, mutableChanges } from "../src/listing_normalizer.ts";
import { deduplicateNormalized, ListingIdentityCollisionError } from "../src/reconciliation.ts";
import type { CarPartListing } from "../src/types.ts";

const base: CarPartListing = {
  year: "2015", makeModel: "Honda Accord", part: "Alternator", sellerUserId: "77",
  partGuid: "part-guid-a",
  stockNumber: " A-1 ", recycler: { name: "Example Recycler" },
  price: { display: "$100", amount: 100, currency: "USD" }, description: "Original", grade: "A",
};

Deno.test("normalization retains identity through mutable changes and reports them", async () => {
  const first = await normalizeListing(base);
  const revised = await normalizeListing({ ...base, price: { display: "$90", amount: 90, currency: "USD" }, description: "Revised", grade: "B" });
  assertEquals(first?.sourceKey, revised?.sourceKey);
  assertEquals(mutableChanges(first!, revised!), ["description", "grade", "priceAmount", "priceDisplay"]);
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
