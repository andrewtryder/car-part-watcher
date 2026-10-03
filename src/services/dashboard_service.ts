import { getCatalog } from "../repositories/catalog_repository.ts";
import { getDatabase } from "../db/database.ts";
import { appTimezone } from "./scheduling_service.ts";
import type { DashboardDto } from "../contracts/dashboard.ts";
import type { RunDto } from "../contracts/runs.ts";

const asIso = (value: Date | string | null | undefined) =>
  value
    ? (value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString())
    : undefined;

export async function getDashboard(): Promise<DashboardDto> {
  const sql = getDatabase();
  const [watches, recentRuns, counts, catalog] = await Promise.all([
    sql`with latest_runs as (select distinct on (watch_id) * from search_runs order by watch_id, started_at desc) select w.*, r.id as run_id, r.status as run_status, r.run_type, r.started_at, r.completed_at, r.listing_count, r.new_listing_count, r.changed_count, r.pages_fetched, r.error_code, r.error_message from watches w left join latest_runs r on r.watch_id=w.id order by w.created_at desc`,
    sql`select r.id, r.watch_id, w.name as watch_name, r.status, r.run_type, r.started_at, r.completed_at, r.listing_count, r.new_listing_count, r.changed_count, r.pages_fetched, r.error_code, r.error_message from search_runs r join watches w on w.id=r.watch_id order by r.started_at desc limit 20`,
    sql`select count(*) filter (where enabled)::int as active_watch_count, count(*) filter (where not enabled)::int as disabled_watch_count, (select count(*)::int from notification_events e join notification_inbox_state i on i.event_id=e.id where e.event_type='new_listing' and i.read_at is null) as new_part_count, (select count(*)::int from notification_deliveries where status='pending') as pending_notification_count, (select count(*)::int from notification_deliveries where status='failed') as failed_notification_count, (select max(started_at) from search_runs) as last_run_at, (select status from search_runs order by started_at desc limit 1) as last_run_status from watches`,
    getCatalog(),
  ]);
  const mapRun = (
    row: Record<string, unknown> | undefined | null,
  ): RunDto | undefined =>
    row
      ? ({
        id: (row.run_id ?? row.id) as string,
        status: (row.run_status ?? row.status) as RunDto["status"],
        runType: row.run_type as RunDto["runType"],
        startedAt: asIso(row.started_at as Date | string),
        completedAt: asIso(row.completed_at as Date | string),
        listingCount: typeof row.listing_count === "number"
          ? row.listing_count
          : undefined,
        newListingCount: typeof row.new_listing_count === "number"
          ? row.new_listing_count
          : undefined,
        changedCount: typeof row.changed_count === "number"
          ? row.changed_count
          : undefined,
        pagesFetched: typeof row.pages_fetched === "number"
          ? row.pages_fetched
          : undefined,
        errorCode: (row.error_code as string) ?? undefined,
        errorMessage: (row.error_message as string) ?? undefined,
      })
      : undefined;
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
    watches: (watches as unknown as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      enabled: Boolean(row.enabled),
      criteria: {
        year: row.year as string,
        makeModel: row.make_model as string,
        part: row.part as string,
        location: (row.location as string) ?? undefined,
        refinementLabel: (row.refinement_label as string) ?? undefined,
      },
      schedule: {
        enabled: Boolean(row.schedule_enabled),
        frequency: row.run_frequency as number,
      },
      lastRun: row.run_id ? mapRun(row) : undefined,
    })),
    recentRuns: (recentRuns as unknown as Record<string, unknown>[]).map(
      (row) => {
        const run = mapRun(row)!;
        return {
          ...run,
          watchId: row.watch_id as string,
          watchName: row.watch_name as string,
        };
      },
    ),
  };
}
