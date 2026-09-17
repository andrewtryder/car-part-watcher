import { identityForListing, sourceKey, type IdentityMethod } from "./identity.ts";
import type { CarPartListing } from "./types.ts";

export interface NormalizedListing {
  source: "car-part";
  sourceKey: string;
  identityMethod: IdentityMethod;
  sellerUserId?: string;
  partSourceId?: string;
  partGuid?: string;
  vehicleGuid?: string;
  stockNumber?: string;
  year?: string;
  makeModel?: string;
  part?: string;
  description?: string;
  damageCode?: string;
  grade?: string;
  priceAmount?: number;
  priceCurrency?: string;
  priceDisplay?: string;
  recyclerName?: string;
  recyclerLocation?: string;
  recyclerPhone?: string;
  imageUrl?: string;
  photoUrl?: string;
  quoteUrl?: string;
  raw: CarPartListing;
}

const clean = (value: string | undefined) => value?.trim().replace(/\s+/g, " ") || undefined;
const identifier = (value: string | undefined) => clean(value)?.toLowerCase();

/** Converts only parser-exposed fields into durable, comparison-safe data. */
export async function normalizeListing(raw: CarPartListing): Promise<NormalizedListing | undefined> {
  const identity = identityForListing(raw);
  const key = await sourceKey(raw);
  if (!identity || !key) return undefined;
  const priceAmount = raw.price?.amount ?? (() => {
    const parsed = Number(raw.price?.display?.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  })();
  return {
    source: "car-part", sourceKey: key, identityMethod: identity.method,
    sellerUserId: identifier(raw.sellerUserId), partSourceId: identifier(raw.partSourceId),
    partGuid: identifier(raw.partGuid), vehicleGuid: identifier(raw.vehicleGuid),
    stockNumber: clean(raw.stockNumber), year: clean(raw.year), makeModel: clean(raw.makeModel),
    part: clean(raw.part), description: clean(raw.description), damageCode: clean(raw.damageCode), grade: clean(raw.grade),
    priceAmount, priceCurrency: clean(raw.price?.currency), priceDisplay: clean(raw.price?.display),
    recyclerName: clean(raw.recycler?.name), recyclerLocation: clean(raw.recycler?.location),
    recyclerPhone: clean(raw.recycler?.phone), imageUrl: clean(raw.imageUrl), photoUrl: clean(raw.photoUrl), quoteUrl: clean(raw.quoteUrl), raw,
  };
}

export interface ListingFieldChange {
  field: string;
  oldValue?: string;
  newValue?: string;
}

export function detailedMutableChanges(
  previous: Record<string, any>,
  next: NormalizedListing,
): ListingFieldChange[] {
  const fields: { key: keyof NormalizedListing; rowKey: string }[] = [
    { key: "priceDisplay", rowKey: "price_display" },
    { key: "priceAmount", rowKey: "price_amount" },
    { key: "grade", rowKey: "grade" },
    { key: "description", rowKey: "description" },
    { key: "damageCode", rowKey: "damage_code" },
    { key: "stockNumber", rowKey: "stock_number" },
    { key: "recyclerName", rowKey: "recycler_name" },
    { key: "recyclerLocation", rowKey: "recycler_location" },
    { key: "recyclerPhone", rowKey: "recycler_phone" },
    { key: "imageUrl", rowKey: "image_url" },
    { key: "photoUrl", rowKey: "photo_url" },
    { key: "quoteUrl", rowKey: "quote_url" },
  ];

  const changes: ListingFieldChange[] = [];
  for (const { key, rowKey } of fields) {
    const rawOld = previous[key] !== undefined ? previous[key] : previous[rowKey];
    const oldVal = (key === "priceAmount" && rawOld !== undefined && rawOld !== null)
      ? Number(rawOld)
      : (rawOld ?? undefined);
    const newVal = next[key] ?? undefined;
    if (oldVal !== newVal) {
      changes.push({
        field: key,
        oldValue: oldVal !== undefined && oldVal !== null ? String(oldVal) : undefined,
        newValue: newVal !== undefined && newVal !== null ? String(newVal) : undefined,
      });
    }
  }
  return changes;
}

export function mutableChanges(previous: NormalizedListing, next: NormalizedListing): string[] {
  const fields: (keyof NormalizedListing)[] = [
    "description", "damageCode", "grade", "priceAmount", "priceCurrency", "priceDisplay",
    "recyclerName", "recyclerLocation", "recyclerPhone", "imageUrl", "photoUrl", "quoteUrl",
  ];
  return fields.filter((field) => previous[field] !== next[field]).map(String);
}

