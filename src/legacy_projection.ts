import { sourceKey, type IdentityMethod } from "./identity.ts";
import type { CarPartListing } from "./types.ts";

/** Diagnostic-only reconstruction of the shifted eight-column production parser. */
export async function legacyProjection(listing: CarPartListing): Promise<{
  listing: CarPartListing; sourceKey?: string; identityMethod?: IdentityMethod;
}> {
  const legacy: CarPartListing = {
    year: listing.year, makeModel: listing.makeModel, part: listing.part,
    description: listing.description,
    grade: listing.damageCode,
    stockNumber: listing.grade,
    price: listing.stockNumber ? { display: listing.stockNumber } : undefined,
    recycler: listing.priceQualifier
      ? { name: listing.priceQualifier, location: listing.price?.display }
      : undefined,
    // The old parser looked for quote links in the price column, so this is absent.
    sellerUserId: undefined,
  };
  const key = await sourceKey(legacy);
  return { listing: legacy, sourceKey: key, identityMethod: key ? "fallback_composite" : undefined };
}
