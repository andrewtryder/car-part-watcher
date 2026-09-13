import type { CarPartListing } from "./types.ts";

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim().toLowerCase().replace(/\s+/g, " ");
  return result || undefined;
}

/** Stable across presentation changes; observed on 48/50 listings in two runs. */
export function primarySourceKey(listing: CarPartListing): string | undefined {
  const stock = normalized(listing.stockNumber);
  const part = normalized(listing.part);
  return listing.sellerUserId && stock && part
    ? `seller-stock-part:${listing.sellerUserId}|${stock}|${part}`
    : undefined;
}

/** Complete in the observed sample; trades coverage for a larger conservative key. */
export function fallbackSourceKey(listing: CarPartListing): string | undefined {
  const recycler = normalized(listing.recycler?.name);
  const stock = normalized(listing.stockNumber);
  const vehicle = `${listing.year ?? ""}|${
    normalized(listing.makeModel) ?? ""
  }`;
  const part = normalized(listing.part);
  return recycler && stock && part && vehicle !== "|"
    ? `recycler-stock-vehicle-part:${recycler}|${stock}|${vehicle}|${part}`
    : undefined;
}

export function sourceKey(listing: CarPartListing): string | undefined {
  return primarySourceKey(listing) ?? fallbackSourceKey(listing);
}
