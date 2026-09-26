import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Clock3,
  LayoutDashboard,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  type Dashboard,
  dashboard,
  notifications,
  refreshCatalog,
  refreshUnreadCount,
  runWatch,
} from "./api.ts";
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
  { label, value, detail, tone }: {
    label: string;
    value: string | number;
    detail?: React.ReactNode;
    tone?: "slate" | "green" | "amber" | "red" | "blue";
  },
) {
  return (
    <section className="stat">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      {detail && (
        <div className="statMeta">
          {tone ? <Badge tone={tone}>{detail}</Badge> : <small>{detail}</small>}
        </div>
      )}
    </section>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<Dashboard>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState<string>();
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
      refreshUnreadCount();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(undefined);
    }
  };

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
          const res = await runWatch(target.id);
          totalResults += res.listingCount ?? 0;
          totalNew += res.newListingCount ?? 0;
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

  const lastRunTone = (status?: string): "green" | "red" | "amber" | "slate" => {
    if (!status) return "slate";
    if (status.toLowerCase().includes("succeed") || status.toLowerCase().includes("ok")) {
      return "green";
    }
    if (status.toLowerCase().includes("fail") || status.toLowerCase().includes("error")) {
      return "red";
    }
    return "amber";
  };

  return (
    <main>
      <header>
        <div className="headerTitleGroup">
          <p className="eyebrow">OPERATIONS</p>
          <h1>Dashboard</h1>
          <div className="status">
            <span className="onlineDot" /> {data?.timezone ?? "Loading timezone…"}
          </div>
        </div>
        <div className="headerActions">
          <button
            onClick={runAllDue}
            disabled={runningAll || !data?.watches?.length}
          >
            <Play size={14} /> {runningAll ? "Running searches…" : "Run all due"}
          </button>
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
                label="Active Searches"
                value={data.summary.activeWatchCount}
                detail="Enabled searches"
              />
              <Link className="statLink" to="/new-parts">
                <Stat
                  label="New Parts"
                  value={data.summary.newPartCount}
                  detail="Unread part events"
                  tone={data.summary.newPartCount > 0 ? "blue" : undefined}
                />
              </Link>
              <Stat
                label="Pending Notifications"
                value={data.summary.pendingNotificationCount}
                detail="Queued events"
              />
              <Stat
                label="Failed Notifications"
                value={data.summary.failedNotificationCount}
                detail="Delivery failures"
                tone={data.summary.failedNotificationCount > 0 ? "red" : undefined}
              />
              <Stat
                label="Last Run"
                value={time(data.summary.lastRunAt, data.timezone)}
                detail={data.summary.lastRunStatus ?? "No runs yet"}
                tone={lastRunTone(data.summary.lastRunStatus)}
              />
            </div>

            {message && <p className="notice" aria-live="polite">{message}</p>}

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
                    <Link className="buttonLink" to="/watches/new">
                      Create saved search
                    </Link>
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
                              {watch.criteria.year} {watch.criteria.makeModel} ·{" "}
                              {watch.criteria.part}
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
                            : <Badge tone="slate">Not scheduled</Badge>}
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
                        <div className="actions cardActions">
                          <Link
                            className="buttonLink quiet"
                            to={`/watches/${watch.id}`}
                          >
                            Open
                          </Link>
                          <button
                            disabled={running === watch.id}
                            onClick={() => execute(watch.id)}
                          >
                            {running === watch.id ? "Running…" : "Run"}
                          </button>
                          <Link
                            className="buttonLink quiet"
                            to={`/watches/${watch.id}/edit`}
                          >
                            Edit
                          </Link>
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
                    <h2>Recent activity</h2>
                  </div>
                </div>
                {data.recentRuns.length
                  ? (
                    <div className="tableWrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Started</th>
                            <th>Watch</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Duration</th>
                            <th>Results</th>
                            <th>New</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.recentRuns.map((run) => (
                            <tr key={run.id}>
                              <td>{time(run.startedAt, data.timezone)}</td>
                              <td>
                                <Link
                                  to={`/watches/${run.watchId}`}
                                  className="accentLink"
                                >
                                  {run.watchName}
                                </Link>
                              </td>
                              <td>
                                {run.runType === "scheduled" ? "Scheduled" : "Manual"}
                              </td>
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
                              <td>{duration(run)}</td>
                              <td>{run.listingCount ?? "—"}</td>
                              <td>{run.newListingCount ?? "—"}</td>
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
                      <p className="muted">
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
              </article>
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
    <aside>
      <div className="brand">
        <div className="brandLogoFrame">
          <img
            className="brandLogo"
            src="/car-part-watcher-logo.svg"
            alt="Car Part Watcher"
          />
        </div>
        <div className="brandTagline">Ops console</div>
      </div>
      <nav>
        <Link className={active("/") ? "active" : ""} to="/">
          <LayoutDashboard size={18} /> Dashboard
        </Link>
        <Link className={active("/watches") ? "active" : ""} to="/watches">
          <Search size={18} /> Saved Searches
        </Link>
        <Link className={active("/new-parts") ? "active" : ""} to="/new-parts">
          <Bell size={18} /> New Parts <em>{unread ?? "0"}</em>
        </Link>
        <Link className={active("/runs") ? "active" : ""} to="/runs">
          <Clock3 size={18} /> Run History
        </Link>
      </nav>
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
