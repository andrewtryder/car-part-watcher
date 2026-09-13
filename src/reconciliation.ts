import type { NormalizedListing } from "./listing_normalizer.ts";

export class ListingIdentityCollisionError extends Error {
  code = "LISTING_IDENTITY_COLLISION";
  constructor(sourceKey: string) { super(`Multiple visibly different results produced ${sourceKey}`); }
}

function signature(listing: NormalizedListing) {
  return [listing.sellerUserId, listing.stockNumber, listing.part, listing.year, listing.makeModel].join("|");
}

export function deduplicateNormalized(listings: NormalizedListing[]) {
  const unique = new Map<string, NormalizedListing>();
  for (const listing of listings) {
    const previous = unique.get(listing.sourceKey);
    if (previous && signature(previous) !== signature(listing)) throw new ListingIdentityCollisionError(listing.sourceKey);
    unique.set(listing.sourceKey, listing);
  }
  return [...unique.values()];
}
