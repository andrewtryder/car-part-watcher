import type { NormalizedListing } from "./listing_normalizer.ts";

const comparable = (value: string | undefined) =>
  value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

function signature(listing: NormalizedListing) {
  return [
    listing.sellerUserId,
    listing.stockNumber,
    listing.year,
    listing.makeModel,
    listing.part,
  ].map(comparable).join("|");
}

export class ListingIdentityCollisionError extends Error {
  code = "LISTING_IDENTITY_COLLISION";
  constructor(sourceKey: string, existingSignature?: string, incomingSignature?: string) {
    const details = existingSignature && incomingSignature
      ? ` (existing=${existingSignature}; incoming=${incomingSignature})`
      : "";
    super(`Multiple visibly different results produced ${sourceKey}${details}`);
  }
}

export function deduplicateNormalized(listings: NormalizedListing[]) {
  const unique = new Map<string, NormalizedListing>();
  for (const listing of listings) {
    const previous = unique.get(listing.sourceKey);
    if (previous) {
      const previousSignature = signature(previous);
      const nextSignature = signature(listing);
      if (previousSignature !== nextSignature) {
        throw new ListingIdentityCollisionError(
          listing.sourceKey,
          previousSignature,
          nextSignature,
        );
      }
    }
    unique.set(listing.sourceKey, listing);
  }
  return [...unique.values()];
}
