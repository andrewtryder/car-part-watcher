import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { recentRuns, type Run, system, type Watch, watches } from "./api.ts";

type HistoryRun = Run & { watchId: string; watchName: string };
const duration = (run: Run) => {
  if (!run.startedAt || !run.completedAt) return "—";
  const seconds = Math.max(
    0,
    Math.round(
      (new Date(run.completedAt).getTime() -
        new Date(run.startedAt).getTime()) / 1000,
    ),
  );
  return seconds >= 60
    ? `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`
    : `${seconds}s`;
};
const date = (value: string | undefined, timezone: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value))
    : "—";
const label = (status: Run["status"]) =>
  status === "succeeded"
    ? "Succeeded"
    : status === "failed"
    ? "Failed"
    : "Running";
const tone = (status: Run["status"]) =>
  status === "succeeded" ? "green" : status === "failed" ? "red" : "amber";

export function GlobalRunHistory() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<HistoryRun[]>();
  const [watchItems, setWatchItems] = useState<Watch[]>([]);
  const [error, setError] = useState(false);
  const [timezone, setTimezone] = useState("America/New_York");
  const load = useCallback(async () => {
    setError(false);
    try {
      setItems(await recentRuns());
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    load();
    watches().then(setWatchItems).catch(() => undefined);
    system().then((value) => setTimezone(value.timezone)).catch(() =>
      undefined
    );
  }, [load]);
  const watchId = params.get("watch") ?? "";
  const status = params.get("status") ?? "";
  const runType = params.get("type") ?? "";
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next);
  };
  const watchOptions = useMemo(
    () =>
      watchItems.length
        ? watchItems.map((item) => [item.id, item.name] as const)
        : [
          ...new Map(
            (items ?? []).map((item) => [item.watchId, item.watchName]),
          )
            .entries(),
        ],
    [items, watchItems],
  );
  const filtered = (items ?? []).filter((item) =>
    (!watchId || item.watchId === watchId) &&
    (!status || item.status === status) &&
    (!runType || item.runType === runType)
  );
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS</p>
          <h1>Run History</h1>
        </div>
        <p className="muted">{timezone}</p>
      </header>
      <section className="panel filters" aria-label="Run history filters">
        <label>
          Saved Search<select
            value={watchId}
            onChange={(event) => update("watch", event.target.value)}
          >
            <option value="">All Saved Searches</option>
            {watchOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Status<select
            value={status}
            onChange={(event) => update("status", event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>
        </label>
        <label>
          Run Type<select
            value={runType}
            onChange={(event) => update("type", event.target.value)}
          >
            <option value="">All run types</option>
            <option value="manual">Manual</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </label>
      </section>
      {error
        ? (
          <section className="state">
            <h2>Could not load run history.</h2>
            <button onClick={load}>Retry</button>
          </section>
        )
        : !items
        ? <section className="skeleton">Recent runs are loading…</section>
        : !filtered.length
        ? (
          <section className="empty">
            <h2>No runs yet.</h2>
            <p>Run a saved search to begin collecting history.</p>
          </section>
        )
        : (
          <div className="tableWrap section">
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Saved Search</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Pages</th>
                  <th>Results</th>
                  <th>New</th>
                  <th>Changed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((run) => (
                  <tr key={run.id}>
                    <td>{date(run.startedAt, timezone)}</td>
                    <td>
                      <Link to={`/watches/${run.watchId}`}>
                        {run.watchName}
                      </Link>
                    </td>
                    <td>
                      {run.runType === "scheduled" ? "Scheduled" : "Manual"}
                    </td>
                    <td>
                      <span className={`badge ${tone(run.status)}`}>
                        {label(run.status)}
                      </span>
                      {run.status === "failed" &&
                        (run.errorCode || run.errorMessage) && (
                        <details>
                          <summary>Error details</summary>
                          <p>
                            {[run.errorCode, run.errorMessage].filter(Boolean)
                              .join(": ")}
                          </p>
                        </details>
                      )}
                    </td>
                    <td>{duration(run)}</td>
                    <td>{run.pagesFetched ?? "—"}</td>
                    <td>{run.listingCount ?? "—"}</td>
                    <td>{run.newListingCount ?? "—"}</td>
                    <td>{run.changedCount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </main>
  );
}
