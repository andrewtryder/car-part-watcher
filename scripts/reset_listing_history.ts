import { getDatabase } from "../src/db/database.ts";

const apply = Deno.args.includes("--apply");
const confirmed = Deno.args.includes("--confirm") && Deno.args.includes("RESET_LISTING_HISTORY");
if (apply && !confirmed) throw new Error("--apply requires --confirm RESET_LISTING_HISTORY");
const sql = getDatabase();
try {
  const [watches, catalogs, listings, associations, runs, events] = await Promise.all([
    sql`select count(*)::int as count from watches`, sql`select count(*)::int as count from source_catalogs`,
    sql`select count(*)::int as count from listings`, sql`select count(*)::int as count from watch_listings`,
    sql`select count(*)::int as count from search_runs`, sql`select count(*)::int as count from notification_events`,
  ]);
  const report = { mutation: apply, watchesPreserved: watches[0].count, catalogsPreserved: catalogs[0].count, listings: listings[0].count, watchListings: associations[0].count, searchRuns: runs[0].count, notificationEvents: events[0].count };
  if (apply) await sql.begin(async (tx) => { await tx`delete from notification_events`; await tx`delete from watch_listings`; await tx`delete from search_runs`; await tx`delete from listings`; });
  console.log(JSON.stringify(report, null, 2));
} finally { await sql.end(); }
