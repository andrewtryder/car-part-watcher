import { assertEquals } from "jsr:@std/assert@1.0.19";
import {
  fallbackSourceKey,
  primarySourceKey,
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

Deno.test("source key ignores price, description, and grade", () => {
  const changed = {
    ...listing,
    price: { display: "$150", amount: 150 },
    description: "Changed description",
    grade: "A",
  };
  assertEquals(sourceKey(changed), sourceKey(listing));
});

Deno.test("different seller and stock combinations produce different source keys", () => {
  assertEquals(
    sourceKey({ ...listing, sellerUserId: "9999" }) === sourceKey(listing),
    false,
  );
  assertEquals(
    sourceKey({ ...listing, stockNumber: "OTHER" }) === sourceKey(listing),
    false,
  );
});

Deno.test("fallback is used only when the preferred seller key is unavailable", () => {
  const withoutSeller = { ...listing, sellerUserId: undefined };
  assertEquals(primarySourceKey(withoutSeller), undefined);
  assertEquals(sourceKey(withoutSeller), fallbackSourceKey(withoutSeller));
});
