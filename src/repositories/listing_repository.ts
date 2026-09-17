import type { CarPartListing } from "../types.ts";
import {
  detailedMutableChanges,
  type ListingFieldChange,
  type NormalizedListing,
} from "../listing_normalizer.ts";
import { getDatabase } from "../db/database.ts";

export type Sql = any;

export interface StoredListing extends NormalizedListing {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
  isModified?: boolean;
  changes?: ListingFieldChange[];
}

const rowToListing = (row: any): StoredListing => ({
  id: row.id,
  source: row.source,
  sourceKey: row.source_key,
  identityMethod: row.identity_method,
  sellerUserId: row.seller_user_id,
  partSourceId: row.part_source_id,
  partGuid: row.part_guid,
  vehicleGuid: row.vehicle_guid,
  stockNumber: row.stock_number,
  year: row.year,
  makeModel: row.make_model,
  part: row.part,
  description: row.description,
  damageCode: row.damage_code,
  grade: row.grade,
  priceAmount: row.price_amount ? Number(row.price_amount) : undefined,
  priceCurrency: row.price_currency,
  priceDisplay: row.price_display,
  recyclerName: row.recycler_name,
  recyclerLocation: row.recycler_location,
  recyclerPhone: row.recycler_phone,
  imageUrl: row.image_url,
  photoUrl: row.photo_url,
  quoteUrl: row.quote_url,
  firstSeenAt: row.first_seen_at.toISOString(),
  lastSeenAt: row.last_seen_at.toISOString(),
  raw: {
    year: row.year,
    makeModel: row.make_model,
    part: row.part,
    description: row.description,
    damageCode: row.damage_code,
    grade: row.grade,
    stockNumber: row.stock_number,
    price: {
      amount: row.price_amount ? Number(row.price_amount) : undefined,
      currency: row.price_currency,
      display: row.price_display,
    },
    recycler: {
      name: row.recycler_name,
      location: row.recycler_location,
      phone: row.recycler_phone,
    },
    imageUrl: row.image_url,
    photoUrl: row.photo_url,
    quoteUrl: row.quote_url,
  } as CarPartListing,
});

export async function findListing(sql: Sql, source: string, sourceKey: string) {
  const row =
    (await sql`select * from listings where source=${source} and source_key=${sourceKey}`)[
      0
    ];
  return row ? rowToListing(row) : undefined;
}

export async function upsertListing(
  sql: Sql,
  next: NormalizedListing,
  observedAt: Date,
  context?: { watchId?: string; runId?: string },
) {
  const existing =
    (await sql`select * from listings where source=${next.source} and source_key=${next.sourceKey}`)[
      0
    ];
  const values = [
    next.sellerUserId ?? null,
    next.partSourceId ?? null,
    next.partGuid ?? null,
    next.vehicleGuid ?? null,
    next.stockNumber ?? null,
    next.year ?? null,
    next.makeModel ?? null,
    next.part ?? null,
    next.description ?? null,
    next.damageCode ?? null,
    next.grade ?? null,
    next.priceAmount ?? null,
    next.priceCurrency ?? null,
    next.priceDisplay ?? null,
    next.recyclerName ?? null,
    next.recyclerLocation ?? null,
    next.recyclerPhone ?? null,
    next.imageUrl ?? null,
    next.photoUrl ?? null,
    next.quoteUrl ?? null,
    observedAt,
  ];
  if (!existing) {
    const id = crypto.randomUUID();
    await sql`insert into listings (id,source,source_key,identity_method,seller_user_id,part_source_id,part_guid,vehicle_guid,stock_number,year,make_model,part,description,damage_code,grade,price_amount,price_currency,price_display,recycler_name,recycler_location,recycler_phone,image_url,photo_url,quote_url,first_seen_at,last_seen_at) values (${id},${next.source},${next.sourceKey},${next.identityMethod},${
      values[0]
    },${values[1]},${values[2]},${values[3]},${values[4]},${values[5]},${
      values[6]
    },${values[7]},${values[8]},${values[9]},${values[10]},${values[11]},${
      values[12]
    },${values[13]},${values[14]},${values[15]},${values[16]},${values[17]},${
      values[18]
    },${values[19]},${observedAt},${observedAt})`;
    return { id, isNew: true, changedFields: [] as string[], changes: [] as ListingFieldChange[] };
  }
  const changes = detailedMutableChanges(existing, next);
  const changedFields = changes.map((c) => c.field);
  if (changes.length > 0 && context?.watchId) {
    for (const change of changes) {
      await sql`insert into listing_changes (id,listing_id,watch_id,search_run_id,field_name,old_value,new_value,created_at) values (${crypto.randomUUID()},${existing.id},${context.watchId},${context.runId ?? null},${change.field},${change.oldValue ?? null},${change.newValue ?? null},${observedAt})`;
    }
  }
  await sql`update listings set identity_method=${next.identityMethod},seller_user_id=${
    values[0]
  },part_source_id=${values[1]},part_guid=${values[2]},vehicle_guid=${
    values[3]
  },stock_number=${values[4]},year=${values[5]},make_model=${values[6]},part=${
    values[7]
  },description=${values[8]},damage_code=${values[9]},grade=${values[10]},price_amount=${
    values[11]
  },price_currency=${values[12]},price_display=${values[13]},recycler_name=${
    values[14]
  },recycler_location=${values[15]},recycler_phone=${values[16]},image_url=${
    values[17]
  },photo_url=${values[18]},quote_url=${values[19]
  },last_seen_at=${observedAt},updated_at=${observedAt} where id=${existing.id}`;
  return { id: existing.id, isNew: false, changedFields, changes };
}

export async function associateListing(
  sql: Sql,
  watchId: string,
  listingId: string,
  runId: string,
  observedAt: Date,
) {
  const existing =
    (await sql`select 1 from watch_listings where watch_id=${watchId} and listing_id=${listingId}`)[
      0
    ];
  if (existing) {
    await sql`update watch_listings set last_seen_at=${observedAt},last_search_run_id=${runId},updated_at=${observedAt} where watch_id=${watchId} and listing_id=${listingId}`;
    return false;
  }
  await sql`insert into watch_listings (watch_id,listing_id,first_seen_at,last_seen_at,first_search_run_id,last_search_run_id) values (${watchId},${listingId},${observedAt},${observedAt},${runId},${runId})`;
  return true;
}
export async function listWatchListings(watchId: string, limit = 500) {
  const sql = getDatabase();
  const rows =
    await sql`select l.*, wl.first_seen_at as watch_first_seen_at, wl.last_seen_at as watch_last_seen_at from watch_listings wl join listings l on l.id=wl.listing_id where wl.watch_id=${watchId} order by wl.last_seen_at desc limit ${
      Math.min(Math.max(limit, 1), 1000)
    }`;
  const listingIds = rows.map((r: any) => r.id);
  const changesByListingId = new Map<string, ListingFieldChange[]>();
  if (listingIds.length > 0) {
    const changeRows = await sql`
      select distinct on (listing_id, field_name) listing_id, field_name, old_value, new_value, created_at
      from listing_changes
      where listing_id in ${sql(listingIds)}
        and watch_id = ${watchId}
      order by listing_id, field_name, created_at desc
    `;
    for (const ch of changeRows) {
      if (!changesByListingId.has(ch.listing_id)) changesByListingId.set(ch.listing_id, []);
      changesByListingId.get(ch.listing_id)!.push({
        field: ch.field_name,
        oldValue: ch.old_value ?? undefined,
        newValue: ch.new_value ?? undefined,
      });
    }
  }

  return rows.map((row: any) => {
    const changes = changesByListingId.get(row.id) ?? [];
    return {
      ...rowToListing(row),
      firstSeenAt: row.watch_first_seen_at?.toISOString() ?? row.first_seen_at.toISOString(),
      lastSeenAt: row.watch_last_seen_at?.toISOString() ?? row.last_seen_at.toISOString(),
      isModified: changes.length > 0,
      changes,
    };
  });
}
