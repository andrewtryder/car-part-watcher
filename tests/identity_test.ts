import { assertEquals } from "jsr:@std/assert@1.0.19";
import {
  fallbackIdentity,
  identityForListing,
  sourceKey,
} from "../src/identity.ts";
import type { CarPartListing } from "../src/types.ts";

const listing: CarPartListing = {
  year: "2015",
  makeModel: "Honda Accord",
  part: "Alternator",
  sellerUserId: "1213",
  stockNumber: "ABC123",
  recycler: { name: "Example Recycler" },
  price: { display: "$107", amount: 107 },
  description: "Original description",
  grade: "B",
};

Deno.test("source key ignores price, description, and grade", async () => {
  const changed = {
    ...listing,
    price: { display: "$150", amount: 150 },
    description: "Changed description",
    grade: "A",
  };
  assertEquals(await sourceKey(changed), await sourceKey(listing));
});

Deno.test("different seller and stock combinations produce different source keys", async () => {
  assertEquals(
    await sourceKey({ ...listing, sellerUserId: "9999" }) === await sourceKey(listing),
    false,
  );
  assertEquals(
    await sourceKey({ ...listing, stockNumber: "OTHER" }) === await sourceKey(listing),
    false,
  );
});

Deno.test("fallback is used only when the preferred seller key is unavailable", () => {
  const withoutSeller = { ...listing, sellerUserId: undefined };
  assertEquals(identityForListing(withoutSeller), fallbackIdentity(withoutSeller));
});
