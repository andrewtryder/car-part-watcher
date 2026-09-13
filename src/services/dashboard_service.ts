import { getCatalog } from "../repositories/catalog_repository.ts";
import { getDatabase } from "../db/database.ts";
import { appTimezone } from "./scheduling_service.ts";

const asIso = (value: Date | null | undefined) => value?.toISOString();

export async function getDashboard() {
  const sql = getDatabase();
  const [watches, recentRuns, counts, catalog] = await Promise.all([
    sql`with latest_runs as (select distinct on (watch_id) * from search_runs order by watch_id, started_at desc) select w.*, r.id as run_id, r.status as run_status, r.run_type, r.started_at, r.completed_at, r.listing_count, r.new_listing_count, r.changed_count, r.pages_fetched, r.error_code, r.error_message from watches w left join latest_runs r on r.watch_id=w.id order by w.created_at desc`,
    sql`select r.id, r.watch_id, w.name as watch_name, r.status, r.run_type, r.started_at, r.completed_at, r.listing_count, r.new_listing_count, r.changed_count, r.pages_fetched, r.error_code, r.error_message from search_runs r join watches w on w.id=r.watch_id order by r.started_at desc limit 20`,
    sql`select count(*) filter (where enabled)::int as active_watch_count, count(*) filter (where not enabled)::int as disabled_watch_count, (select count(*)::int from notification_events where event_type='new_listing' and created_at >= now() - interval '24 hours') as new_part_count, (select count(*)::int from notification_events where status='pending') as pending_notification_count, (select count(*)::int from notification_events where status='failed') as failed_notification_count, (select max(started_at) from search_runs) as last_run_at, (select status from search_runs order by started_at desc limit 1) as last_run_status from watches`,
    getCatalog(),
  ]);
  const mapRun = (row: any) =>
    row && ({
      id: row.run_id ?? row.id,
      status: row.run_status ?? row.status,
      runType: row.run_type,
      startedAt: asIso(row.started_at),
      completedAt: asIso(row.completed_at),
      listingCount: row.listing_count ?? undefined,
      newListingCount: row.new_listing_count ?? undefined,
      changedCount: row.changed_count ?? undefined,
      pagesFetched: row.pages_fetched ?? undefined,
      errorCode: row.error_code ?? undefined,
      errorMessage: row.error_message ?? undefined,
    });
  const summary = counts[0];
  return {
    timezone: appTimezone(),
    summary: {
      activeWatchCount: summary.active_watch_count ?? 0,
      disabledWatchCount: summary.disabled_watch_count ?? 0,
      newPartCount: summary.new_part_count ?? 0,
      pendingNotificationCount: summary.pending_notification_count ?? 0,
      failedNotificationCount: summary.failed_notification_count ?? 0,
      lastRunAt: asIso(summary.last_run_at),
      lastRunStatus: summary.last_run_status ?? undefined,
    },
    catalog: catalog &&
      {
        fetchedAt: catalog.fetchedAt,
        yearCount: catalog.payload.years.length,
        makeModelCount: catalog.payload.makeModels.length,
        partCount: catalog.payload.parts.length,
      },
    watches: watches.map((row: any) => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      criteria: {
        year: row.year,
        makeModel: row.make_model,
        part: row.part,
        location: row.location ?? undefined,
        refinementLabel: row.refinement_label ?? undefined,
      },
      schedule: { enabled: row.schedule_enabled, frequency: row.run_frequency },
      lastRun: row.run_id ? mapRun(row) : undefined,
    })),
    recentRuns: recentRuns.map((row: any) => ({
      ...mapRun(row),
      watchId: row.watch_id,
      watchName: row.watch_name,
    })),
  };
}
