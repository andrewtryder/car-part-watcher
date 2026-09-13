import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Clock3,
  LayoutDashboard,
  RefreshCw,
  Search,
  Settings,
  Wrench,
} from "lucide-react";
import { type Dashboard, dashboard, refreshCatalog, runWatch } from "./api.ts";
import { Inbox } from "./Inbox.tsx";

const frequency = (value: number) =>
  value === 1
    ? "Once daily"
    : value === 2
    ? "Twice daily"
    : "Three times daily";
const time = (value: string | undefined, zone: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
      timeZone: zone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value))
    : "Not run yet";
const duration = (run: { startedAt?: string; completedAt?: string }) =>
  run.startedAt && run.completedAt
    ? `${
      Math.max(
        0,
        Math.round(
          (new Date(run.completedAt).getTime() -
            new Date(run.startedAt).getTime()) / 1000,
        ),
      )
    }s`
    : "—";
function Badge(
  { children, tone = "slate" }: {
    children: React.ReactNode;
    tone?: "slate" | "green" | "amber" | "red" | "blue";
  },
) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Stat(
  { label, value, detail }: {
    label: string;
    value: string | number;
    detail?: string;
  },
) {
  return (
    <section className="stat">
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </section>
  );
}
export function App() {
  if (window.location.pathname === "/new-parts") return <Inbox />;
  const [data, setData] = useState<Dashboard>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setError(undefined);
    try {
      setData(await dashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load dashboard");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const execute = async (id: string) => {
    setRunning(id);
    setMessage(undefined);
    try {
      const result = await runWatch(id);
      setMessage(
        `${result.listingCount ?? 0} results · ${
          result.newListingCount ?? 0
        } new · ${result.changedCount ?? 0} changed`,
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(undefined);
    }
  };
  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshCatalog();
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Catalog refresh failed");
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <Wrench size={20} /> Car Part Watcher
        </div>
        <nav>
          <a className="active">
            <LayoutDashboard size={18} />Dashboard
          </a>
          <a aria-disabled="true">
            <Search size={18} />Saved Searches <em>Next</em>
          </a>
          <a aria-disabled="true">
            <Bell size={18} />New Parts <em>Next</em>
          </a>
          <a aria-disabled="true">
            <Clock3 size={18} />Run History <em>Next</em>
          </a>
          <a aria-disabled="true">
            <Settings size={18} />Settings <em>Next</em>
          </a>
        </nav>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">OPERATIONS</p>
            <h1>Dashboard</h1>
          </div>
          <div className="status">
            <span /> {data?.timezone ?? "Loading timezone…"}
          </div>
        </header>
        {error
          ? (
            <section className="state">
              <h2>Could not load dashboard</h2>
              <p>{error}</p>
              <button onClick={load}>Retry</button>
            </section>
          )
          : !data
          ? <section className="skeleton">Loading dashboard…</section>
          : (
            <>
              <div className="stats">
                <Stat
                  label="New Parts"
                  value={data.summary.newPartCount}
                  detail="new_listing events in last 24 hours"
                />
                <Stat
                  label="Active Watches"
                  value={data.summary.activeWatchCount}
                />
                <Stat
                  label="Last Run"
                  value={time(data.summary.lastRunAt, data.timezone)}
                  detail={data.summary.lastRunStatus ?? "No runs yet"}
                />
              </div>
              {message && <p className="notice" aria-live="polite">{message}
              </p>}
              <section className="section">
                <div className="sectionHead">
                  <div>
                    <p className="eyebrow">SAVED SEARCHES</p>
                    <h2>Watch health</h2>
                  </div>
                </div>
                {data.watches.length === 0
                  ? (
                    <div className="empty">
                      <Search size={28} />
                      <h3>No saved searches yet</h3>
                      <p>Create a saved search to start watching for parts.</p>
                      <small>Saved Search editor coming next.</small>
                    </div>
                  )
                  : (
                    <div className="watchGrid">
                      {data.watches.map((watch) => (
                        <article className="watch" key={watch.id}>
                          <div className="watchTop">
                            <div>
                              <h3>{watch.name}</h3>
                              <p>
                                {watch.criteria.year} {watch.criteria.makeModel}
                                {" "}
                                · {watch.criteria.part}
                              </p>
                            </div>
                            <Badge tone={watch.enabled ? "green" : "slate"}>
                              {watch.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                          <p className="criteria">
                            {watch.criteria.location || "All areas"}
                            {watch.criteria.refinementLabel
                              ? ` · ${watch.criteria.refinementLabel}`
                              : ""}
                          </p>
                          <div className="badges">
                            {watch.schedule.enabled
                              ? (
                                <Badge tone="blue">
                                  {frequency(watch.schedule.frequency)}
                                </Badge>
                              )
                              : <Badge>Not scheduled</Badge>}
                            {(watch.lastRun?.newListingCount ?? 0) > 0 && (
                              <Badge tone="amber">
                                {watch.lastRun!.newListingCount} New
                              </Badge>
                            )}
                          </div>
                          <dl>
                            <div>
                              <dt>Last run</dt>
                              <dd>
                                {time(watch.lastRun?.startedAt, data.timezone)}
                              </dd>
                            </div>
                            <div>
                              <dt>Results</dt>
                              <dd>{watch.lastRun?.listingCount ?? "—"}</dd>
                            </div>
                            <div>
                              <dt>Changed</dt>
                              <dd>{watch.lastRun?.changedCount ?? "—"}</dd>
                            </div>
                          </dl>
                          <div className="actions">
                            <button
                              disabled={running === watch.id}
                              onClick={() =>
                                execute(watch.id)}
                            >
                              {running === watch.id
                                ? "Running search…"
                                : "Run Now"}
                            </button>
                            <button className="quiet" disabled>View</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
              </section>
              <section className="twoCol">
                <article className="panel">
                  <div className="sectionHead">
                    <div>
                      <p className="eyebrow">RECENT RUNS</p>
                      <h2>Latest activity</h2>
                    </div>
                  </div>
                  {data.recentRuns.length
                    ? (
                      <div className="tableWrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Watch</th>
                              <th>Started</th>
                              <th>Results</th>
                              <th>New</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.recentRuns.map((run) => (
                              <tr key={run.id}>
                                <td>
                                  {run.watchName}
                                  <small>
                                    {run.runType ?? "manual"} · {duration(run)}
                                  </small>
                                </td>
                                <td>{time(run.startedAt, data.timezone)}</td>
                                <td>{run.listingCount ?? "—"}</td>
                                <td>{run.newListingCount ?? "—"}</td>
                                <td>
                                  <Badge
                                    tone={run.status === "succeeded"
                                      ? "green"
                                      : run.status === "failed"
                                      ? "red"
                                      : "amber"}
                                  >
                                    {run.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                    : <p className="muted">No runs recorded yet.</p>}
                </article>
                <article className="panel catalog">
                  <div className="sectionHead">
                    <div>
                      <p className="eyebrow">CAR-PART CATALOG</p>
                      <h2>Catalog status</h2>
                    </div>
                    <button
                      className="quiet icon"
                      disabled={refreshing}
                      onClick={refresh}
                      aria-label="Refresh catalog"
                    >
                      <RefreshCw
                        size={16}
                        className={refreshing ? "spin" : ""}
                      />
                    </button>
                  </div>
                  {data.catalog
                    ? (
                      <>
                        <p>
                          Last refreshed{" "}
                          {time(data.catalog.fetchedAt, data.timezone)}
                        </p>
                        <div className="catalogCounts">
                          <span>
                            <b>{data.catalog.yearCount}</b> years
                          </span>
                          <span>
                            <b>
                              {data.catalog.makeModelCount.toLocaleString()}
                            </b>{" "}
                            makes/models
                          </span>
                          <span>
                            <b>{data.catalog.partCount}</b> parts
                          </span>
                        </div>
                      </>
                    )
                    : (
                      <p className="muted">
                        Catalog has not been initialized.
                      </p>
                    )}
                  <p className="muted">
                    {data.summary.pendingNotificationCount} pending events ·
                    {" "}
                    {data.summary.failedNotificationCount} failed events
                  </p>
                </article>
              </section>
            </>
          )}
      </main>
    </div>
  );
}
