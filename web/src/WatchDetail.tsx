import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  deleteWatch,
  type Run,
  saveWatch,
  system,
  type Watch,
  watch,
  type WatchDraft,
  type WatchListing,
  watchListings,
  watchRuns,
} from "./api.ts";
import { WatchRunHistory } from "./components/watch-detail/WatchRunHistory.tsx";
import { WatchSummary } from "./components/watch-detail/WatchSummary.tsx";
import { RunStatusBadge } from "./components/RunStatusBadge.tsx";
import { useRunWatch } from "./hooks/useRunWatch.ts";

import {
  formatDate as formatWithDate,
  formatDuration,
  formatFieldLabel,
} from "./utils/format.ts";

const draftFor = (value: Watch): WatchDraft => ({
  ...value,
  refinementLabel: value.refinement?.label,
});

const formatDate = (value: string | undefined, timezone: string) =>
  formatWithDate(value, timezone, {
    includeYear: true,
    fallback: "Not available",
  });

type SortField =
  | "photo"
  | "vehicle"
  | "details"
  | "price"
  | "recycler"
  | "firstSeen"
  | "lastSeen"
  | "actions"
  | "modified";

type SortDirection = "asc" | "desc";

function parsePrice(display?: string): number {
  if (!display) return Number.POSITIVE_INFINITY;
  const cleaned = display.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? Number.POSITIVE_INFINITY : num;
}

function SectionError({ retry }: { retry: () => void }) {
  return (
    <p className="notice error">
      Could not load this section.{" "}
      <button type="button" className="quiet inlineButton" onClick={retry}>
        Retry
      </button>
    </p>
  );
}

export function Listings({
  items,
  loading,
  failed,
  timezone,
  limit,
  onLimitChange,
  onRun,
  retry,
}: {
  items?: WatchListing[];
  loading: boolean;
  failed: boolean;
  timezone: string;
  limit: number;
  onLimitChange: (limit: number) => void;
  onRun: () => void;
  retry: () => void;
}) {
  const [sortField, setSortField] = useState<SortField>("lastSeen");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filterMode, setFilterMode] = useState<"all" | "modified">("all");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      if (
        field === "lastSeen" ||
        field === "firstSeen" ||
        field === "photo" ||
        field === "actions" ||
        field === "modified"
      ) {
        setSortDirection("desc");
      } else {
        setSortDirection("asc");
      }
    }
  };

  const sortedItems = useMemo(() => {
    if (!items) return [];
    let list = [...items];
    if (filterMode === "modified") {
      list = list.filter((item) => item.isModified);
    }
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "modified": {
          const modA = a.isModified ? 1 : 0;
          const modB = b.isModified ? 1 : 0;
          comparison = modA - modB;
          break;
        }
        case "photo": {
          const valA = a.imageUrl ? 1 : 0;
          const valB = b.imageUrl ? 1 : 0;
          comparison = valA - valB;
          break;
        }
        case "vehicle": {
          const strA = [a.year, a.makeModel, a.part].filter(Boolean).join(" ");
          const strB = [b.year, b.makeModel, b.part].filter(Boolean).join(" ");
          comparison = strA.localeCompare(strB, undefined, {
            sensitivity: "base",
          });
          break;
        }
        case "details": {
          const strA = [a.description, a.damageCode, a.grade, a.stockNumber]
            .filter(Boolean)
            .join(" ");
          const strB = [b.description, b.damageCode, b.grade, b.stockNumber]
            .filter(Boolean)
            .join(" ");
          comparison = strA.localeCompare(strB, undefined, {
            sensitivity: "base",
          });
          break;
        }
        case "price": {
          const priceA = a.priceAmount ?? parsePrice(a.priceDisplay);
          const priceB = b.priceAmount ?? parsePrice(b.priceDisplay);
          comparison = priceA - priceB;
          break;
        }
        case "recycler": {
          const strA = [a.recyclerName, a.recyclerLocation]
            .filter(Boolean)
            .join(" ");
          const strB = [b.recyclerName, b.recyclerLocation]
            .filter(Boolean)
            .join(" ");
          comparison = strA.localeCompare(strB, undefined, {
            sensitivity: "base",
          });
          break;
        }
        case "firstSeen": {
          const timeA = a.firstSeenAt ? new Date(a.firstSeenAt).getTime() : 0;
          const timeB = b.firstSeenAt ? new Date(b.firstSeenAt).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case "lastSeen": {
          const timeA = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          const timeB = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case "actions": {
          const countA = (a.photoUrl ? 1 : 0) + (a.quoteUrl ? 1 : 0);
          const countB = (b.photoUrl ? 1 : 0) + (b.quoteUrl ? 1 : 0);
          comparison = countA - countB;
          break;
        }
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return list;
  }, [items, filterMode, sortField, sortDirection]);

  const renderSortHeader = (field: SortField, label: string) => {
    const isActive = sortField === field;
    return (
      <th
        className="sortableTh"
        onClick={() => handleSort(field)}
        title={`Click to sort by ${label} (${
          isActive && sortDirection === "asc" ? "descending" : "ascending"
        })`}
      >
        <span className="sortThContent">
          <span>{label}</span>
          {isActive
            ? (
              sortDirection === "asc"
                ? <ArrowUp size={14} className="sortIconActive" />
                : <ArrowDown size={14} className="sortIconActive" />
            )
            : <ArrowUpDown size={14} className="sortIconInactive" />}
        </span>
      </th>
    );
  };

  return (
    <section className="section">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">RECENTLY SEEN</p>
          <h2>Recently Seen Parts</h2>
        </div>
        <div className="tableControls">
          <label>
            Filter
            <select
              value={filterMode}
              onChange={(e) =>
                setFilterMode(e.target.value as "all" | "modified")}
            >
              <option value="all">All parts</option>
              <option value="modified">Modified only</option>
            </select>
          </label>
          <label>
            Sort
            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split("-") as [
                  SortField,
                  SortDirection,
                ];
                setSortField(field);
                setSortDirection(dir);
              }}
            >
              <option value="lastSeen-desc">Last Seen (Newest first)</option>
              <option value="lastSeen-asc">Last Seen (Oldest first)</option>
              <option value="modified-desc">Modified first</option>
              <option value="firstSeen-desc">First Seen (Newest first)</option>
              <option value="firstSeen-asc">First Seen (Oldest first)</option>
              <option value="price-asc">Price (Lowest first)</option>
              <option value="price-desc">Price (Highest first)</option>
              <option value="vehicle-asc">Vehicle (A – Z)</option>
              <option value="vehicle-desc">Vehicle (Z – A)</option>
              <option value="recycler-asc">Recycler (A – Z)</option>
              <option value="recycler-desc">Recycler (Z – A)</option>
              <option value="details-asc">Details (A – Z)</option>
              <option value="details-desc">Details (Z – A)</option>
              <option value="photo-desc">With Photo first</option>
            </select>
          </label>
          <label>
            Show
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500 (All)</option>
              <option value={1000}>1000 (All)</option>
            </select>
          </label>
          <span className="muted">
            Showing {sortedItems.length}{" "}
            {sortedItems.length === 1 ? "part" : "parts"}
          </span>
        </div>
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
            <button type="button" onClick={onRun}>Run now</button>
          </section>
        )
        : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  {renderSortHeader("photo", "Photo")}
                  {renderSortHeader("vehicle", "Vehicle")}
                  {renderSortHeader("details", "Details")}
                  {renderSortHeader("price", "Price")}
                  {renderSortHeader("recycler", "Recycler")}
                  {renderSortHeader("firstSeen", "First Seen")}
                  {renderSortHeader("lastSeen", "Last Seen")}
                  {renderSortHeader("actions", "Actions")}
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const priceChange = item.changes?.find((c) =>
                    c.field === "price_display" || c.field === "priceDisplay"
                  );
                  const nonPriceChanges = item.changes?.filter((c) =>
                    c.field !== "price_display" && c.field !== "priceDisplay"
                  ) ?? [];

                  return (
                    <tr key={item.id}>
                      <td>
                        {item.imageUrl
                          ? (
                            <a
                              href={item.photoUrl || item.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="listingThumbLink"
                            >
                              <img
                                src={item.imageUrl}
                                alt="Part thumbnail"
                                className="listingThumb"
                                width="64"
                                height="48"
                              />
                            </a>
                          )
                          : (
                            <div className="listingThumbPlaceholder">
                              No Photo
                            </div>
                          )}
                      </td>
                      <td>
                        <strong>
                          {[item.year, item.makeModel, item.part].filter(
                            Boolean,
                          )
                            .join(" ") || "Part"}
                        </strong>
                        {item.isModified && (
                          <div style={{ marginTop: "4px" }}>
                            <span className="badge amber">
                              MODIFIED
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        {[
                          item.description,
                          item.damageCode && `Damage: ${item.damageCode}`,
                          item.grade && `Grade: ${item.grade}`,
                          item.stockNumber && `Stock #${item.stockNumber}`,
                        ].filter(Boolean).map((text) => (
                          <div key={text}>{text}</div>
                        ))}
                        {nonPriceChanges.length > 0 && (
                          <div className="changeTagsGroup">
                            {nonPriceChanges.map((ch, idx) => (
                              <span
                                key={idx}
                                className="changeTag"
                                title={`Was: ${ch.oldValue ?? "none"}`}
                              >
                                {formatFieldLabel(ch.field)}:{" "}
                                {ch.oldValue ?? "none"} →{" "}
                                {ch.newValue ?? "none"}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {priceChange
                          ? (
                            <div className="changeDiffText">
                              <span className="oldPriceStrike">
                                {priceChange.oldValue || "—"}
                              </span>
                              <span className="diffArrow">→</span>
                              <span className="diffHighlight">
                                {item.priceDisplay || "—"}
                              </span>
                            </div>
                          )
                          : <strong>{item.priceDisplay || "—"}</strong>}
                      </td>
                      <td>
                        <div>{item.recyclerName || "—"}</div>
                        {item.recyclerLocation && (
                          <small className="muted">
                            {item.recyclerLocation}
                          </small>
                        )}
                      </td>
                      <td>{formatDate(item.firstSeenAt, timezone)}</td>
                      <td>{formatDate(item.lastSeenAt, timezone)}</td>
                      <td>
                        {item.photoUrl || item.quoteUrl
                          ? (
                            <div className="accentLinks">
                              {item.photoUrl && (
                                <a
                                  href={item.photoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="accentLink"
                                >
                                  Photos
                                </a>
                              )}
                              {item.photoUrl && item.quoteUrl && (
                                <span className="separator">·</span>
                              )}
                              {item.quoteUrl && (
                                <a
                                  href={item.quoteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="accentLink"
                                >
                                  Request Quote
                                </a>
                              )}
                            </div>
                          )
                          : <span className="muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
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
  const [listingsLimit, setListingsLimit] = useState<number>(500);
  const [runError, setRunError] = useState(false);
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

  const loadListings = useCallback(async (limit = listingsLimit) => {
    if (!id) return;
    setListingError(false);
    try {
      setListings(await watchListings(id, limit));
    } catch {
      setListingError(true);
    }
  }, [id, listingsLimit]);

  const handleLimitChange = (newLimit: number) => {
    setListingsLimit(newLimit);
    loadListings(newLimit);
  };

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

  const { execute: executeWatch, runningWatchId } = useRunWatch({
    refresh,
    onMessage: setMessage,
    messages: {
      start: () => "Running search…",
      success: (result) =>
        "skipped" in result
          ? "Run skipped"
          : `${result.listingCount} results · ${
            result.newListingCount ?? 0
          } new · ${result.changedCount ?? 0} changed · ${
            result.pagesFetched ?? 0
          } pages`,
    },
  });

  const execute = () => {
    if (id) void executeWatch(id);
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
      <Link className="backLink" to="/watches">← Saved Searches</Link>
      <WatchSummary
        item={item}
        timezone={timezone}
        running={Boolean(runningWatchId)}
        onRun={execute}
        onToggle={toggle}
        onDelete={remove}
      />

      {message && <p className="notice">{message}</p>}
      {!item.enabled && (
        <p className="notice">
          Automatic runs are disabled. You can still run this search manually.
        </p>
      )}

      <section className="stats detailStats">
        <article className="stat">
          <p className="eyebrow">Last Run</p>
          <strong>
            {latest ? formatDate(latest.startedAt, timezone) : "Not run yet"}
          </strong>
          {latest && (
            <div className="statMeta">
              <RunStatusBadge status={latest.status} />
            </div>
          )}
        </article>
        <article className="stat">
          <p className="eyebrow">Last Successful</p>
          <strong>
            {lastSuccessful
              ? formatDate(lastSuccessful.startedAt, timezone)
              : "Not yet"}
          </strong>
          {lastSuccessful && (
            <small className="muted">
              {formatDuration(lastSuccessful)} duration
            </small>
          )}
        </article>
        <article className="stat">
          <p className="eyebrow">Recently Seen Count</p>
          <strong>{listings?.length ?? "0"}</strong>
          <small className="muted">Bounded recent list</small>
        </article>
        <article className="stat">
          <p className="eyebrow">New on Last Run</p>
          <strong>{latest?.newListingCount ?? "—"}</strong>
          <small className="muted">Fresh discoveries</small>
        </article>
        <article className="stat">
          <p className="eyebrow">Changed on Last Run</p>
          <strong>{latest?.changedCount ?? "—"}</strong>
          <small className="muted">Price/status changes</small>
        </article>
      </section>

      <Listings
        items={listings}
        loading={!listings && !listingError}
        failed={listingError}
        timezone={timezone}
        limit={listingsLimit}
        onLimitChange={handleLimitChange}
        onRun={execute}
        retry={() => loadListings(listingsLimit)}
      />

      <WatchRunHistory
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
