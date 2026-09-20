import type { CarPartListing } from "./types.ts";

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim().toLowerCase().replace(/\s+/g, " ");
  return result || undefined;
}

/** Historical values remain in the union because persisted rows may predate the current strategy. */
export type IdentityMethod = "seller_stock_part_guid" | "part_guid" | "seller_stock_source" | "fallback_composite" | "seller_stock_part";

export interface ListingIdentity {
  method: IdentityMethod;
  canonical: string;
}

export function listingIdentity(listing: CarPartListing): ListingIdentity | undefined {
  const seller = normalized(listing.sellerUserId);
  const stock = normalized(listing.stockNumber);
  const part = normalized(listing.part);
  return seller && stock && part
    ? { method: "seller_stock_part", canonical: `${seller}|${stock}|${part}` }
    : undefined;
}

/** Complete in the observed sample; trades coverage for a larger conservative key. */
export function fallbackIdentity(listing: CarPartListing): ListingIdentity | undefined {
  const recycler = normalized(listing.recycler?.name);
  const stock = normalized(listing.stockNumber);
  const vehicle = `${listing.year ?? ""}|${
    normalized(listing.makeModel) ?? ""
  }`;
  const part = normalized(listing.part);
  return recycler && stock && part && vehicle !== "|"
    ? { method: "fallback_composite", canonical: `${recycler}|${stock}|${vehicle}|${part}` }
    : undefined;
}

export function identityForListing(listing: CarPartListing): ListingIdentity | undefined {
  return listingIdentity(listing);
}

export async function sourceKey(listing: CarPartListing): Promise<string | undefined> {
  const identity = identityForListing(listing);
  if (!identity) return undefined;
  const bytes = new TextEncoder().encode(`car-part:v3:${identity.method}:${identity.canonical}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `car-part:v3:sha256:${hash}`;
}
