import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Clock3,
  LayoutDashboard,
  Play,
  Search,
  Settings,
} from "lucide-react";
import {
  type Dashboard,
  dashboard,
  notifications,
  refreshCatalog,
  refreshUnreadCount,
} from "./api.ts";
import { useRunWatch } from "./hooks/useRunWatch.ts";
import { Inbox } from "./Inbox.tsx";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { WatchForm, WatchList } from "./Watches.tsx";
import { WatchDetail } from "./WatchDetail.tsx";
import { GlobalRunHistory } from "./RunHistory.tsx";

import { formatDate, formatDuration } from "./utils/format.ts";
import {
  failureMessage,
  WatchHealthBadge,
} from "./components/WatchHealthBadge.tsx";

const frequency = (value: number) =>
  value === 1
    ? "Once daily"
    : value === 2
    ? "Twice daily"
    : "Three times daily";

const time = (value: string | undefined, zone: string) =>
  formatDate(value, zone, { fallback: "Not run yet" });

const duration = (run: { startedAt?: string; completedAt?: string }) =>
  formatDuration(run);

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
    detail?: React.ReactNode;
  },
) {
  return (
    <section className="stat">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </section>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<Dashboard>();
  const [error, setError] = useState<string>();
  const [runningAll, setRunningAll] = useState(false);
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

  const { execute, request, runningWatchId: running } = useRunWatch({
    refresh: load,
    onMessage: setMessage,
    messages: {
      success: (result) =>
        "skipped" in result
          ? "Run skipped"
          : `${result.listingCount} results · ${
            result.newListingCount ?? 0
          } new · ${result.changedCount ?? 0} changed`,
    },
  });

  const runAllDue = async () => {
    if (!data?.watches.length || runningAll) return;
    setRunningAll(true);
    setMessage("Running due searches…");
    const enabledWatches = data.watches.filter((w) => w.enabled);
    const targets = enabledWatches.length ? enabledWatches : data.watches;
    let totalNew = 0;
    let totalResults = 0;
    try {
      for (const target of targets) {
        try {
          const res = await request(target.id);
          if (!("skipped" in res)) {
            totalResults += res.listingCount;
            totalNew += res.newListingCount;
          }
        } catch {
          // continue with remaining watches
        }
      }
      setMessage(
        `Completed running ${targets.length} search${
          targets.length === 1 ? "" : "es"
        }: ${totalResults} results · ${totalNew} new listings`,
      );
      await load();
      refreshUnreadCount();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Run all due failed");
    } finally {
      setRunningAll(false);
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
    <main>
      <header>
        <div className="headerTitleGroup">
          <p className="eyebrow">OPS CONSOLE</p>
          <h1>Dashboard</h1>
          <p className="muted">{data?.timezone ?? "Loading timezone…"}</p>
        </div>
        <div className="headerActions">
          <button
            type="button"
            onClick={runAllDue}
            disabled={runningAll || !data?.watches?.length}
          >
            <Play size={14} /> {runningAll ? "Running…" : "Run all"}
          </button>
        </div>
      </header>

      {error
        ? (
          <section className="state">
            <h2>Could not load dashboard</h2>
            <p>{error}</p>
            <button type="button" onClick={load}>Retry</button>
          </section>
        )
        : !data
        ? <section className="skeleton">Loading dashboard…</section>
        : (
          <>
            <div className="stats">
              <Stat
                label="Searches"
                value={data.watches.length}
                detail={`${data.summary.activeWatchCount} enabled`}
              />
              <Link className="statLink" to="/new-parts">
                <Stat
                  label="New Parts"
                  value={data.summary.newPartCount}
                  detail="Unread events"
                />
              </Link>
              <Stat
                label="Runs today"
                value={data.recentRuns.filter((run) => {
                  if (!run.startedAt) return false;
                  return new Date(run.startedAt).toDateString() ===
                    new Date().toDateString();
                }).length}
                detail="Recent search runs"
              />
              <Stat
                label="Failing searches"
                value={data.summary.failingWatchCount ?? 0}
                detail="Scheduled failures need attention"
              />
              <Stat
                label="Catalog"
                value={data.catalog ? "OK" : "—"}
                detail={data.catalog
                  ? `Refreshed ${time(data.catalog.fetchedAt, data.timezone)}`
                  : "Not initialized"}
              />
            </div>

            {message && <p className="notice" aria-live="polite">{message}</p>}

            {data.failingWatches?.length > 0 && (
              <section className="section">
                <div className="sectionHead">
                  <h2>Needs attention</h2>
                  <Link
                    className="accentLink"
                    to="/runs?status=failed&type=scheduled"
                  >
                    View failed runs
                  </Link>
                </div>
                <div className="listCard">
                  {data.failingWatches.map((watch) => (
                    <article className="listRow" key={watch.id}>
                      <div>
                        <Link
                          className="accentLink"
                          to={`/watches/${watch.id}`}
                        >
                          {watch.name}
                        </Link>
                        <p className="muted">
                          {failureMessage(watch.health) ??
                            "Scheduled search failed"} ·{" "}
                          {time(watch.health.lastFailureAt, data.timezone)}
                        </p>
                      </div>
                      <WatchHealthBadge health={watch.health} />
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="section">
              <div className="sectionHead">
                <h2>Saved searches</h2>
                <Link className="accentLink" to="/watches/new">Add search</Link>
              </div>
              {data.watches.length === 0
                ? (
                  <div className="empty">
                    <Search size={28} />
                    <h3>No saved searches yet</h3>
                    <p>Create a saved search to start watching for parts.</p>
                    <Link className="buttonLink" to="/watches/new">
                      Create saved search
                    </Link>
                  </div>
                )
                : (
                  <div className="listCard">
                    {data.watches.map((watch) => (
                      <article className="listRow" key={watch.id}>
                        <div>
                          <h3>{watch.name}</h3>
                          <p className="muted">
                            {watch.criteria.year} {watch.criteria.makeModel} ·
                            {" "}
                            {watch.criteria.part}
                            {watch.criteria.refinementLabel
                              ? ` · ${watch.criteria.refinementLabel}`
                              : ""}
                          </p>
                          <div className="inlineStatus">
                            <WatchHealthBadge health={watch.health} />
                            <Badge tone={watch.enabled ? "green" : "slate"}>
                              {watch.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                            {watch.schedule.enabled
                              ? (
                                <Badge tone="blue">
                                  {frequency(watch.schedule.frequency)}
                                </Badge>
                              )
                              : <Badge tone="slate">Not scheduled</Badge>}
                          </div>
                        </div>
                        <div className="listMeta">
                          {(watch.lastRun?.newListingCount ?? 0) > 0
                            ? (
                              <span className="listStatus listStatusNew">
                                {watch.lastRun?.newListingCount} new
                              </span>
                            )
                            : <span className="listStatus">Idle</span>}
                          <small>
                            {time(watch.lastRun?.startedAt, data.timezone)}
                          </small>
                          <div className="rowActions">
                            <button
                              type="button"
                              className="linkButton"
                              disabled={running === watch.id}
                              onClick={() =>
                                execute(watch.id)}
                            >
                              {running === watch.id ? "Running…" : "Run"}
                            </button>
                            <Link
                              className="accentLink"
                              to={`/watches/${watch.id}`}
                            >
                              Open
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
            </section>

            <section className="section">
              <div className="sectionHead">
                <h2>Recent activity</h2>
                <button
                  type="button"
                  className="linkButton"
                  disabled={refreshing}
                  onClick={refresh}
                >
                  {refreshing ? "Refreshing catalog…" : "Refresh catalog"}
                </button>
              </div>
              {data.recentRuns.length
                ? (
                  <div className="listCard">
                    {data.recentRuns.slice(0, 8).map((run) => (
                      <article className="listRow activityRow" key={run.id}>
                        <div>
                          <p className="activityTitle">
                            <Link
                              to={`/watches/${run.watchId}`}
                              className="accentLink"
                            >
                              {run.watchName}
                            </Link>{" "}
                            {run.newListingCount
                              ? `found ${run.newListingCount} new listings`
                              : run.status === "failed"
                              ? "run failed"
                              : "finished with no changes"}
                          </p>
                          <p className="muted">
                            {run.runType === "scheduled"
                              ? "Scheduled"
                              : "Manual"} · {duration(run)}
                          </p>
                        </div>
                        <small>{time(run.startedAt, data.timezone)}</small>
                      </article>
                    ))}
                    {data.catalog && (
                      <article className="listRow activityRow">
                        <div>
                          <p className="activityTitle">
                            Catalog refresh completed
                          </p>
                          <p className="muted">
                            {data.catalog.yearCount} years ·{" "}
                            {data.catalog.makeModelCount.toLocaleString()}{" "}
                            makes/models · {data.catalog.partCount} parts
                          </p>
                        </div>
                        <small>
                          {time(data.catalog.fetchedAt, data.timezone)}
                        </small>
                      </article>
                    )}
                  </div>
                )
                : <p className="muted">No activity yet.</p>}
            </section>
          </>
        )}
    </main>
  );
}

function ConsoleNav() {
  const location = useLocation();
  const [unread, setUnread] = useState<number>();

  const loadUnread = useCallback(() => {
    notifications().then((value) => setUnread(value.unreadCount)).catch(() =>
      undefined
    );
  }, []);

  useEffect(() => {
    loadUnread();
    globalThis.addEventListener("new-parts-count-changed", loadUnread);
    const timer = setInterval(loadUnread, 60_000);
    return () => {
      globalThis.removeEventListener("new-parts-count-changed", loadUnread);
      clearInterval(timer);
    };
  }, [loadUnread]);

  const active = (path: string) =>
    location.pathname === path ||
    (path === "/watches" && location.pathname.startsWith("/watches"));

  return (
    <aside className="appSidebar">
      <div className="sidebarMain">
        <div className="brand">
          <img
            className="brandIcon"
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
          />
          <div className="brandText">
            <span>Car Part Watcher</span>
          </div>
        </div>
        <p className="sidebarLabel">OPS CONSOLE</p>
        <nav>
          <Link className={active("/") ? "active" : ""} to="/">
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link className={active("/watches") ? "active" : ""} to="/watches">
            <Search size={18} /> Saved searches
          </Link>
          <Link
            className={active("/new-parts") ? "active" : ""}
            to="/new-parts"
          >
            <Bell size={18} /> New parts <em>{unread ?? "0"}</em>
          </Link>
          <Link className={active("/runs") ? "active" : ""} to="/runs">
            <Clock3 size={18} /> Run history
          </Link>
        </nav>
      </div>
      <div className="sidebarFooter">
        <button type="button" className="settingsRow" disabled>
          <Settings size={16} /> Settings
        </button>
      </div>
    </aside>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <ConsoleNav />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/new-parts" element={<Inbox />} />
          <Route path="/watches" element={<WatchList />} />
          <Route path="/watches/new" element={<WatchForm />} />
          <Route path="/watches/:id" element={<WatchDetail />} />
          <Route path="/watches/:id/edit" element={<WatchForm />} />
          <Route path="/runs" element={<GlobalRunHistory />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
