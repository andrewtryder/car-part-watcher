import { runCarPartSearch } from "./browser/car_part_browser.ts";
import { BrowserlessBrowserProvider } from "./browser/browserless_browser_provider.ts";
import type { CarPartListing } from "./types.ts";

type Candidate =
  | "partGuid"
  | "sellerStock"
  | "sourceStock"
  | "sellerStockPart"
  | "conservative";

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim().toLowerCase().replace(/\s+/g, " ");
  return result || undefined;
}

function key(
  listing: CarPartListing,
  candidate: Candidate,
): string | undefined {
  const part = normalized(listing.part);
  const seller = listing.sellerUserId;
  const stock = normalized(listing.stockNumber);
  switch (candidate) {
    case "partGuid":
      return listing.partGuid;
    case "sellerStock":
      return seller && stock ? `${seller}|${stock}` : undefined;
    case "sourceStock":
      return listing.partSourceId && stock
        ? `${listing.partSourceId}|${stock}`
        : undefined;
    case "sellerStockPart":
      return seller && stock && part ? `${seller}|${stock}|${part}` : undefined;
    case "conservative": {
      const recycler = normalized(listing.recycler?.name);
      const vehicle = `${listing.year ?? ""}|${
        normalized(listing.makeModel) ?? ""
      }`;
      return recycler && stock && part && vehicle !== "|"
        ? `${recycler}|${stock}|${vehicle}|${part}`
        : undefined;
    }
  }
}

function grouped(listings: CarPartListing[], candidate: Candidate) {
  const groups = new Map<string, CarPartListing[]>();
  for (const listing of listings) {
    const value = key(listing, candidate);
    if (value) groups.set(value, [...(groups.get(value) ?? []), listing]);
  }
  return groups;
}

function changed(first: CarPartListing, second: CarPartListing) {
  const fields = ["price", "description", "grade"] as const;
  return fields.filter((field) =>
    JSON.stringify(first[field]) !== JSON.stringify(second[field])
  );
}

const first = await runCarPartSearch(
  new BrowserlessBrowserProvider(),
);
const second = await runCarPartSearch(
  new BrowserlessBrowserProvider(),
);
const candidates: Candidate[] = [
  "partGuid",
  "sellerStock",
  "sourceStock",
  "sellerStockPart",
  "conservative",
];

const report = Object.fromEntries(candidates.map((candidate) => {
  const one = grouped(first.results.listings, candidate);
  const two = grouped(second.results.listings, candidate);
  const overlap = [...one.keys()].filter((value) => two.has(value));
  const mutableChanges = overlap.flatMap((value) =>
    changed(one.get(value)![0], two.get(value)![0])
  );
  return [candidate, {
    run1Coverage: one.size,
    run2Coverage: two.size,
    overlap: overlap.length,
    run1Collisions: [...one.values()].filter((items) =>
      items.length > 1
    ).length,
    run2Collisions: [...two.values()].filter((items) =>
      items.length > 1
    ).length,
    run1Missing: first.results.listings.length - one.size,
    run2Missing: second.results.listings.length - two.size,
    apparentAdditions: [...two.keys()].filter((value) =>
      !one.has(value)
    ).length,
    apparentRemovals: [...one.keys()].filter((value) => !two.has(value)).length,
    mutableFieldChanges: [...new Set(mutableChanges)],
  }];
}));

console.log(JSON.stringify(
  {
    run1Listings: first.results.count,
    run2Listings: second.results.count,
    report,
  },
  null,
  2,
));
