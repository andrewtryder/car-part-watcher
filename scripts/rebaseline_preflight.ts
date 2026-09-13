import { BrowserlessBrowserProvider } from "../src/browser/browserless_browser_provider.ts";
import { runCarPartSearch } from "../src/browser/car_part_browser.ts";
import { getDatabase } from "../src/db/database.ts";
import { identityForListing } from "../src/identity.ts";
import { legacyProjection } from "../src/legacy_projection.ts";
import { normalizeListing, type NormalizedListing } from "../src/listing_normalizer.ts";
import { getWatch } from "../src/repositories/watch_repository.ts";

const [watchId, ...extra] = Deno.args.filter((arg) => arg !== "--");
if (!watchId || extra.length) throw new Error("Usage: deno task rebaseline-preflight -- <watch-id>");
const watch = await getWatch(watchId);
if (!watch) throw new Error("Watch not found");
const pages: Array<{ page: number; rawRows: number; fingerprint: string }> = [];
const result = await runCarPartSearch(new BrowserlessBrowserProvider(), watch, () => {}, {
  onPage: ({ number, listings }) => {
    const fingerprint = listings.map((item) => [item.sellerUserId, item.stockNumber, item.partGuid].filter(Boolean).join("|")).join("\n");
    pages.push({ page: number, rawRows: listings.length, fingerprint: fingerprint.slice(0, 160) });
    console.log(`page=${number} rawRows=${listings.length} cumulativeRaw=${pages.reduce((sum, item) => sum + item.rawRows, 0)}`);
  },
});
const normalized = (await Promise.all(result.results.listings.map(normalizeListing))).filter((item): item is NormalizedListing => Boolean(item));
const correctedGroups = new Map<string, NormalizedListing[]>();
for (const listing of normalized) correctedGroups.set(listing.sourceKey, [...(correctedGroups.get(listing.sourceKey) ?? []), listing]);
const correctedUnique = [...correctedGroups.values()].map((items) => items[0]);
const signature = (listing: NormalizedListing) => JSON.stringify([listing.year, listing.makeModel, listing.part, listing.description, listing.grade, listing.stockNumber, listing.sellerUserId]);
const correctedCollisionGroups = [...correctedGroups.entries()].filter(([, items]) => new Set(items.map(signature)).size > 1);
const legacy = await Promise.all(result.results.listings.map(legacyProjection));
const legacyGroups = new Map<string, typeof legacy>();
for (const item of legacy) if (item.sourceKey) legacyGroups.set(item.sourceKey, [...(legacyGroups.get(item.sourceKey) ?? []), item]);
const sql = getDatabase();
try {
  const legacyRows = await sql`select l.id,l.source_key from watch_listings wl join listings l on l.id=wl.listing_id where wl.watch_id=${watch.id}`;
  const ids = legacyRows.map((row: any) => row.id);
  const otherWatchRefs = ids.length ? await sql`select count(*)::int as count from watch_listings where listing_id in ${sql(ids)} and watch_id<>${watch.id}` : [{ count: 0 }];
  const notificationRefs = ids.length ? await sql`select count(*)::int as count from notification_events where listing_id in ${sql(ids)}` : [{ count: 0 }];
  const accord = await sql`select count(*)::int as total,count(seller_user_id)::int as seller_identity,count(*) filter (where price_display like '$%')::int as dollar_prices from listings where make_model='Honda Accord' and part='Alternator'`;
  const link = (field: "imageUrl" | "photoUrl" | "quoteUrl") => result.results.listings.filter((item) => item[field]).length;
  const noIdentity = result.results.listings.filter((item) => !identityForListing(item)).length;
  const sellerIdentity = result.results.listings.filter((item) => identityForListing(item)?.method === "seller_stock_part").length;
  const fallbackIdentity = result.results.listings.filter((item) => identityForListing(item)?.method === "fallback_composite").length;
  const groups = [...legacyGroups.entries()].map(([key, items]) => ({ legacySourceKey: key, correctedRows: items.length, stocks: items.map((item) => item.listing.stockNumber).filter(Boolean), sellers: items.map((item) => item.listing.sellerUserId).filter(Boolean), partGuids: items.map((item) => item.listing.partGuid).filter(Boolean) }));
  const report = {
    // runCarPartSearch returns only after its forward-link traversal ends.
    // hasNextPage is retained for older callers and may see non-forward pager links.
    complete: true,
    watch: { id: watch.id, name: watch.name, scheduleEnabled: watch.scheduleEnabled, runFrequency: watch.runFrequency },
    source: { pagesFetched: result.results.pagesFetched, rawRows: result.results.listings.length, correctedNormalized: normalized.length, correctedUnique: correctedUnique.length, pageDiagnostics: pages },
    legacyProjection: { uniqueKeys: legacyGroups.size, singleMemberGroups: groups.filter((item) => item.correctedRows === 1).length, multiMemberGroups: groups.filter((item) => item.correctedRows > 1).length, largestGroup: Math.max(0, ...groups.map((item) => item.correctedRows)), groups },
    correctedIdentity: { sellerStockPart: sellerIdentity, fallback: fallbackIdentity, noIdentity, keyCollisions: correctedCollisionGroups.length, collisionGroups: correctedCollisionGroups.map(([key, items]) => ({ key, rows: items.length, sellers: items.map((item) => item.sellerUserId), stocks: items.map((item) => item.stockNumber) })) },
    references: { legacyCrvRows: legacyRows.length, outsideCrvWatch: otherWatchRefs[0].count, notificationEvents: notificationRefs[0].count },
    accord: { ...accord[0], affected: false },
    links: { imageUrl: link("imageUrl"), photoUrl: link("photoUrl"), quoteUrl: link("quoteUrl"), listingUrl: 0 },
    samples: result.results.listings.filter((item) => ["799239", "17", "FKC062", "6A91150A", "$U000419"].includes(item.stockNumber ?? "")).slice(0, 10).map((item) => ({ stockNumber: item.stockNumber, damageCode: item.damageCode, grade: item.grade, priceDisplay: item.price?.display, recyclerName: item.recycler?.name, recyclerLocation: item.recycler?.location, image: Boolean(item.imageUrl), photo: Boolean(item.photoUrl), quote: Boolean(item.quoteUrl) })),
    rebaseline: { associationsToDetach: legacyRows.length, rowsToSupersede: legacyRows.length, correctedAssociations: correctedUnique.length, notifications: 0 },
  };
  await Deno.writeTextFile("/tmp/crv-rebaseline-preflight.json", JSON.stringify(report, null, 2));
  await Deno.writeTextFile("/tmp/crv-rebaseline-preflight.txt", `complete=${report.complete}\npages=${report.source.pagesFetched}\nraw=${report.source.rawRows}\ncorrectedUnique=${report.source.correctedUnique}\nlegacyUnique=${report.legacyProjection.uniqueKeys}\nlossyGroups=${report.legacyProjection.multiMemberGroups}\nlargestGroup=${report.legacyProjection.largestGroup}\nnoIdentity=${report.correctedIdentity.noIdentity}\ncollisions=${report.correctedIdentity.keyCollisions}\n`);
  console.log(JSON.stringify({ complete: report.complete, pages: report.source.pagesFetched, raw: report.source.rawRows, correctedUnique: report.source.correctedUnique, legacyUnique: report.legacyProjection.uniqueKeys, lossyGroups: report.legacyProjection.multiMemberGroups, largestGroup: report.legacyProjection.largestGroup, noIdentity, collisions: report.correctedIdentity.keyCollisions }, null, 2));
} finally { await sql.end(); }
