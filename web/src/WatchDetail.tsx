import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteWatch,
  refreshUnreadCount,
  type Run,
  runWatch,
  saveWatch,
  system,
  type Watch,
  watch,
  type WatchDraft,
  type WatchListing,
  watchListings,
  watchRuns,
} from "./api.ts";

const frequency: Record<number, string> = {
  1: "Once daily",
  2: "Twice daily",
  3: "Three times daily",
};
const draftFor = (value: Watch): WatchDraft => ({
  ...value,
  refinementLabel: value.refinement?.label,
});
const formatDate = (value: string | undefined, timezone: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value))
    : "Not available";
const formatDuration = (run: Run) => {
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
const statusLabel = (status: Run["status"]) =>
  status === "succeeded"
    ? "Success"
    : status === "failed"
    ? "Failed"
    : "Running";
const statusTone = (status: Run["status"]) =>
  status === "succeeded" ? "green" : status === "failed" ? "red" : "amber";

function SectionError({ retry }: { retry: () => void }) {
  return (
    <p className="notice error">
      Could not load this section.{" "}
      <button className="quiet inlineButton" onClick={retry}>Retry</button>
    </p>
  );
}

function Listings({
  items,
  loading,
  failed,
  timezone,
  onRun,
  retry,
}: {
  items?: WatchListing[];
  loading: boolean;
  failed: boolean;
  timezone: string;
  onRun: () => void;
  retry: () => void;
}) {
  return (
    <section className="section">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">RECENTLY SEEN</p>
          <h2>Recently Seen Parts</h2>
        </div>
        <span className="muted">Most recent {items?.length ?? 0}</span>
      </div>
      {loading
        ? (
          <div className="skeleton detailSkeleton">
            Loading recently seen parts…
          </div>
        )
        : failed
        ? <SectionError retry={retry} />
        : !items?.length
        ? (
          <section className="empty">
            <h3>No parts seen yet.</h3>
            <p>Run this saved search to establish its baseline.</p>
            <button onClick={onRun}>Run Now</button>
          </section>
        )
        : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Details</th>
                  <th>Price</th>
                  <th>Recycler</th>
                  <th>First Seen</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {[item.year, item.makeModel, item.part].filter(Boolean)
                        .join(" ") || "Part"}
                    </td>
                    <td>
                      {[
                        item.description,
                        item.grade && `Grade: ${item.grade}`,
                        item.stockNumber && `Stock #${item.stockNumber}`,
                      ].filter(Boolean).map((text) => (
                        <div key={text}>{text}</div>
                      )) || "—"}
                    </td>
                    <td>{item.priceDisplay || "—"}</td>
                    <td>
                      {[item.recyclerName, item.recyclerLocation].filter(
                        Boolean,
                      ).join(" · ") || "—"}
                    </td>
                    <td>{formatDate(item.firstSeenAt, timezone)}</td>
                    <td>{formatDate(item.lastSeenAt, timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}

function RunHistory({
  runs,
  loading,
  failed,
  timezone,
  onRun,
  retry,
}: {
  runs?: Run[];
  loading: boolean;
  failed: boolean;
  timezone: string;
  onRun: () => void;
  retry: () => void;
}) {
  return (
    <section className="section">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">ACTIVITY</p>
          <h2>Recent Runs</h2>
        </div>
      </div>
      {loading
        ? <div className="skeleton detailSkeleton">Loading recent runs…</div>
        : failed
        ? <SectionError retry={retry} />
        : !runs?.length
        ? (
          <section className="empty">
            <h3>No runs yet.</h3>
            <p>Run this saved search to start collecting results.</p>
            <button onClick={onRun}>Run Now</button>
          </section>
        )
        : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Started</th>
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
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{formatDate(run.startedAt, timezone)}</td>
                    <td>
                      {run.runType === "scheduled" ? "Scheduled" : "Manual"}
                    </td>
                    <td>
                      <span className={`badge ${statusTone(run.status)}`}>
                        {statusLabel(run.status)}
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
                    <td>{formatDuration(run)}</td>
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
    </section>
  );
}

export function WatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Watch>();
  const [listings, setListings] = useState<WatchListing[]>();
  const [runs, setRuns] = useState<Run[]>();
  const [timezone, setTimezone] = useState("America/New_York");
  const [watchError, setWatchError] = useState<string>();
  const [listingError, setListingError] = useState(false);
  const [runError, setRunError] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string>();
  const loadWatch = useCallback(async () => {
    if (!id) return;
    setWatchError(undefined);
    try {
      setItem(await watch(id));
    } catch (error) {
      setWatchError(
        error instanceof Error ? error.message : "Could not load saved search",
      );
    }
  }, [id]);
  const loadListings = useCallback(async () => {
    if (!id) return;
    setListingError(false);
    try {
      setListings(await watchListings(id));
    } catch {
      setListingError(true);
    }
  }, [id]);
  const loadRuns = useCallback(async () => {
    if (!id) return;
    setRunError(false);
    try {
      setRuns(await watchRuns(id));
    } catch {
      setRunError(true);
    }
  }, [id]);
  const refresh = useCallback(async () => {
    await Promise.all([loadWatch(), loadListings(), loadRuns()]);
  }, [loadWatch, loadListings, loadRuns]);
  useEffect(() => {
    refresh();
    system().then((value) => setTimezone(value.timezone)).catch(() =>
      undefined
    );
  }, [refresh]);
  const execute = async () => {
    if (!id || running) return;
    setRunning(true);
    setMessage("Running search…");
    try {
      const result = await runWatch(id);
      setMessage(
        `${result.listingCount ?? 0} results · ${
          result.newListingCount ?? 0
        } new · ${result.changedCount ?? 0} changed · ${
          result.pagesFetched ?? 0
        } pages`,
      );
      await refresh();
      refreshUnreadCount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };
  const toggle = async () => {
    if (!item || !id) return;
    try {
      await saveWatch({ ...draftFor(item), enabled: !item.enabled }, id);
      await loadWatch();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update saved search",
      );
    }
  };
  const remove = async () => {
    if (
      !item || !id || !confirm(`Delete “${item.name}”? This cannot be undone.`)
    ) return;
    try {
      await deleteWatch(id);
      navigate("/watches");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not delete saved search",
      );
    }
  };
  if (watchError) {
    return (
      <main className="detailPage">
        <section className="empty">
          <h1>
            {watchError === "Not found"
              ? "Saved search not found."
              : "Could not load saved search."}
          </h1>
          <p>
            {watchError === "Not found"
              ? "It may have been deleted."
              : watchError}
          </p>
          <Link className="buttonLink" to="/watches">
            Back to Saved Searches
          </Link>
        </section>
      </main>
    );
  }
  if (!item) {
    return (
      <main className="detailPage">
        <div className="skeleton detailSkeleton">Loading saved search…</div>
      </main>
    );
  }
  const latest = runs?.[0];
  const lastSuccessful = runs?.find((run) => run.status === "succeeded");
  return (
    <main className="detailPage">
      <Link to="/watches">← Saved Searches</Link>
      <header className="detailHeader">
        <div>
          <p className="eyebrow">SAVED SEARCH</p>
          <h1>{item.name}</h1>
          <p className="criteria">
            {[item.year, item.makeModel, item.part].filter(Boolean).join(" · ")}
          </p>
          <p className="muted">
            {item.location || "Any location"}
            {item.refinement?.label ? ` · ${item.refinement.label}` : ""}
          </p>
          <div className="badges">
            <span className={`badge ${item.enabled ? "green" : "slate"}`}>
              {item.enabled ? "Enabled" : "Disabled"}
            </span>
            <span className="badge">
              {item.scheduleEnabled ? "Scheduled" : "Unscheduled"}
            </span>
            {item.scheduleEnabled && (
              <span className="badge blue">{frequency[item.runFrequency]}</span>
            )}
          </div>
          <p className="muted">Timezone: {timezone}</p>
        </div>
        <div className="detailActions">
          <button onClick={execute} disabled={running}>
            {running ? "Running search…" : "Run Now"}
          </button>
          <Link to={`/watches/${item.id}/edit`}>Edit</Link>
          <Link to={`/new-parts?watchId=${item.id}`}>View New Parts</Link>
          <button className="quiet" onClick={toggle}>
            {item.enabled ? "Disable" : "Enable"}
          </button>
          <button className="danger" onClick={remove}>Delete</button>
        </div>
      </header>
      {message && <p className="notice">{message}</p>}
      {!item.enabled && (
        <p className="notice">
          Automatic runs are disabled. You can still run this search manually.
        </p>
      )}
      <section className="stats detailStats">
        <article className="stat">
          <p>Last Run</p>
          <strong>
            {latest ? formatDate(latest.startedAt, timezone) : "Not run yet"}
          </strong>
          <small>{latest ? statusLabel(latest.status) : ""}</small>
        </article>
        <article className="stat">
          <p>Last Successful Run</p>
          <strong>
            {lastSuccessful
              ? formatDate(lastSuccessful.startedAt, timezone)
              : "Not yet"}
          </strong>
        </article>
        <article className="stat">
          <p>Recently Seen</p>
          <strong>{listings?.length ?? "—"}</strong>
          <small>Bounded recent list</small>
        </article>
        {latest && (
          <>
            <article className="stat">
              <p>New on Last Run</p>
              <strong>{latest.newListingCount ?? "—"}</strong>
            </article>
            <article className="stat">
              <p>Changed on Last Run</p>
              <strong>{latest.changedCount ?? "—"}</strong>
            </article>
          </>
        )}
      </section>
      <Listings
        items={listings}
        loading={!listings && !listingError}
        failed={listingError}
        timezone={timezone}
        onRun={execute}
        retry={loadListings}
      />
      <RunHistory
        runs={runs}
        loading={!runs && !runError}
        failed={runError}
        timezone={timezone}
        onRun={execute}
        retry={loadRuns}
      />
    </main>
  );
}
