import { getDatabase } from "../db/database.ts";
import type { WatchHealthDto } from "../contracts/watches.ts";

interface WatchHealthRow {
  watch_id: string;
  latest_run_status?: "running" | "succeeded" | "failed" | null;
  latest_scheduled_run_status?: "running" | "succeeded" | "failed" | null;
  last_successful_at?: Date | null;
  last_scheduled_run_at?: Date | null;
  last_failure_at?: Date | null;
  last_failure_code?: string | null;
  last_failure_message?: string | null;
  consecutive_scheduled_failures?: number | string | null;
  completed_run_count?: number | string | null;
}

const asIso = (value?: Date | null) => value?.toISOString();

export function mapWatchHealth(row: WatchHealthRow): WatchHealthDto {
  const completedRunCount = Number(row.completed_run_count ?? 0);
  const consecutiveScheduledFailures = Number(
    row.consecutive_scheduled_failures ?? 0,
  );
  return {
    status: completedRunCount === 0
      ? "never_run"
      : consecutiveScheduledFailures > 0
      ? "failing"
      : "healthy",
    latestRunStatus: row.latest_run_status ?? undefined,
    latestScheduledRunStatus: row.latest_scheduled_run_status ?? undefined,
    lastSuccessfulAt: asIso(row.last_successful_at),
    lastScheduledRunAt: asIso(row.last_scheduled_run_at),
    lastFailureAt: asIso(row.last_failure_at),
    lastFailureCode: row.last_failure_code ?? undefined,
    lastFailureMessage: row.last_failure_message ?? undefined,
    consecutiveScheduledFailures,
  };
}

/**
 * Derives operational health in one set-based query. Manual runs remain in the
 * latest/last-success fields, but only scheduled successes reset scheduled
 * failures.
 */
export async function listWatchHealth(): Promise<Map<string, WatchHealthDto>> {
  const rows = await getDatabase()`
    select w.id as watch_id,
      latest_run.status as latest_run_status,
      latest_scheduled.status as latest_scheduled_run_status,
      latest_success.completed_at as last_successful_at,
      latest_scheduled.started_at as last_scheduled_run_at,
      latest_failure.completed_at as last_failure_at,
      latest_failure.error_code as last_failure_code,
      latest_failure.error_message as last_failure_message,
      completed_runs.completed_run_count,
      scheduled_failures.consecutive_scheduled_failures
    from watches w
    left join lateral (
      select status from search_runs
      where watch_id = w.id
      order by started_at desc limit 1
    ) latest_run on true
    left join lateral (
      select status, started_at from search_runs
      where watch_id = w.id and run_type = 'scheduled'
      order by started_at desc limit 1
    ) latest_scheduled on true
    left join lateral (
      select completed_at from search_runs
      where watch_id = w.id and status = 'succeeded'
      order by started_at desc limit 1
    ) latest_success on true
    left join lateral (
      select completed_at, error_code, error_message from search_runs
      where watch_id = w.id and status = 'failed'
      order by started_at desc limit 1
    ) latest_failure on true
    left join lateral (
      select count(*)::int as completed_run_count from search_runs
      where watch_id = w.id and status in ('succeeded', 'failed')
    ) completed_runs on true
    left join lateral (
      select count(*)::int as consecutive_scheduled_failures
      from search_runs failed_runs
      where failed_runs.watch_id = w.id
        and failed_runs.run_type = 'scheduled'
        and failed_runs.status = 'failed'
        and failed_runs.started_at > coalesce((
          select max(succeeded_runs.started_at) from search_runs succeeded_runs
          where succeeded_runs.watch_id = w.id
            and succeeded_runs.run_type = 'scheduled'
            and succeeded_runs.status = 'succeeded'
        ), '-infinity'::timestamptz)
    ) scheduled_failures on true
  `;
  return new Map(
    (rows as unknown as WatchHealthRow[]).map((row) => [
      row.watch_id,
      mapWatchHealth(row),
    ]),
  );
}
