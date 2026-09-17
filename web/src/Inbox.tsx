import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  markAllRead,
  markRead,
  type Notification,
  notifications,
  refreshUnreadCount,
  system,
  type Watch,
  watches,
} from "./api.ts";

const date = (value: string, timezone: string) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const joined = (...parts: Array<string | undefined>) =>
  parts.filter(Boolean).join(" · ");

function formatFieldLabel(field: string): string {
  switch (field) {
    case "price_display":
    case "priceDisplay":
      return "Price";
    case "grade":
      return "Grade";
    case "description":
      return "Description";
    case "damage_code":
    case "damageCode":
      return "Damage Code";
    case "recycler_name":
    case "recyclerName":
      return "Recycler";
    case "recycler_location":
    case "recyclerLocation":
      return "Location";
    case "stock_number":
    case "stockNumber":
      return "Stock #";
    case "photo_url":
    case "photoUrl":
      return "Photos";
    default:
      return field;
  }
}

export function Inbox() {
  const [params, setParams] = useSearchParams();
  const all = params.get("status") === "all";
  const watchId = params.get("watchId") ?? "";
  const typeFilter = params.get("type") ?? "";
  const [data, setData] = useState<
    { items: Notification[]; unreadCount: number }
  >();
  const [watchItems, setWatchItems] = useState<Watch[]>([]);
  const [timezone, setTimezone] = useState("America/New_York");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setData(
        await notifications({
          all,
          watchId: watchId || undefined,
          type: typeFilter || undefined,
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load notifications.",
      );
    }
  }, [all, watchId, typeFilter]);

  useEffect(() => {
    load();
    watches().then(setWatchItems).catch(() => undefined);
    system().then((value) => setTimezone(value.timezone)).catch(() =>
      undefined
    );
  }, [load]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next);
  };

  const markOne = async (id: string) => {
    setBusy(id);
    try {
      await markRead(id);
      refreshUnreadCount();
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not mark part as read.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const markAll = async () => {
    setBusy("all");
    try {
      await markAllRead(watchId || undefined);
      refreshUnreadCount();
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not mark parts as read.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <main className="inbox">
      <header>
        <div className="headerTitleGroup">
          <p className="eyebrow">NOTIFICATIONS</p>
          <h1>New Parts</h1>
          <p className="muted">
            {data
              ? data.unreadCount
                ? `${data.unreadCount} unread notification${
                  data.unreadCount === 1 ? "" : "s"
                }`
                : "No unread parts"
              : "Loading unread count…"}
          </p>
        </div>
        {data?.unreadCount
          ? (
            <div className="headerActions">
              <button disabled={busy === "all"} onClick={markAll}>
                {busy === "all"
                  ? "Marking read…"
                  : watchId
                  ? "Mark all read for this search"
                  : "Mark all read"}
              </button>
            </div>
          )
          : null}
      </header>

      <section className="panel inboxControls">
        <div className="tabs" aria-label="Notification status">
          <button
            className={!all ? "activeTab" : ""}
            onClick={() => update("status", "")}
          >
            Unread
          </button>
          <button
            className={all ? "activeTab" : ""}
            onClick={() => update("status", "all")}
          >
            All
          </button>
        </div>
        <label>
          Type
          <select
            value={typeFilter}
            onChange={(event) => update("type", event.target.value)}
          >
            <option value="">All Notifications</option>
            <option value="new_listing">New Parts Only</option>
            <option value="listing_updated">Modified Parts Only</option>
          </select>
        </label>
        <label>
          Saved Search
          <select
            value={watchId}
            onChange={(event) => update("watchId", event.target.value)}
          >
            <option value="">All Saved Searches</option>
            {watchItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </section>

      {error
        ? (
          <section className="state">
            <h2>Could not load notifications.</h2>
            <p>{error}</p>
            <button onClick={load}>Retry</button>
          </section>
        )
        : !data
        ? <section className="skeleton">Loading notifications…</section>
        : !data.items.length
        ? (
          <section className="empty">
            <h2>{all ? "No notifications recorded" : "You’re all caught up"}</h2>
            <p>
              {all
                ? "Parts and changes will appear here after a saved search runs."
                : "No unread notifications right now."}
            </p>
          </section>
        )
        : (
          <section className="inboxList">
            {data.items.map((event) => {
              const listing = event.payload.listing;
              const isUpdated = event.eventType === "listing_updated";
              const changes = event.payload.changes ?? [];

              return (
                <article
                  className={`watch notification ${
                    isUpdated ? "notificationModified" : ""
                  } ${event.readAt ? "read" : "unread"}`}
                  key={event.id}
                >
                  <div className="watchTop">
                    <span
                      className={`badge ${
                        event.readAt ? "slate" : isUpdated ? "amber" : "blue"
                      }`}
                    >
                      {event.readAt ? "Read" : isUpdated ? "MODIFIED" : "NEW"}
                    </span>
                    <small className="muted">
                      {isUpdated ? "Updated" : "Found"} {date(event.createdAt, timezone)}
                    </small>
                  </div>

                  <div className="notificationMediaRow">
                    {listing.imageUrl
                      ? (
                        <a
                          href={listing.photoUrl || listing.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="listingThumbLink"
                        >
                          <img
                            src={listing.imageUrl}
                            alt={listing.title}
                            className="listingThumb"
                            width="64"
                            height="48"
                          />
                        </a>
                      )
                      : <div className="listingThumbPlaceholder">No Photo</div>}

                    <div className="notificationBody">
                      <h2>{listing.title}</h2>
                      {(listing.description || listing.grade ||
                        listing.stockNumber || listing.price ||
                        listing.damageCode) && (
                        <p className="criteria">
                          {joined(
                            listing.price,
                            listing.grade && `Grade ${listing.grade}`,
                            listing.damageCode && `Damage ${listing.damageCode}`,
                            listing.stockNumber &&
                              `Stock #${listing.stockNumber}`,
                            listing.description,
                          )}
                        </p>
                      )}

                      {isUpdated && changes.length > 0 && (
                        <div className="changeDiffBox">
                          <div className="changeDiffHeader">What Changed</div>
                          {changes.map((ch, idx) => (
                            <div key={idx} className="changeDiffRow">
                              <span className="changeDiffField">
                                {formatFieldLabel(ch.field)}:
                              </span>
                              <span className="changeDiffOld">
                                {ch.oldValue || "—"}
                              </span>
                              <span className="diffArrow">→</span>
                              <span className="changeDiffNew">
                                {ch.newValue || "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(listing.recyclerName || listing.location) && (
                        <p>
                          {listing.recyclerName && (
                            <strong>{listing.recyclerName}</strong>
                          )}
                          {listing.recyclerName && listing.location ? " · " : ""}
                          {listing.location}
                        </p>
                      )}
                      <p className="muted">
                        Saved search:{" "}
                        <Link
                          to={`/watches/${event.watchId}`}
                          className="accentLink"
                        >
                          {event.payload.watch.name}
                        </Link>
                      </p>
                    </div>
                  </div>

                  <div className="notificationFooter">
                    <div className="accentLinks">
                      {listing.photoUrl
                        ? (
                          <a
                            href={listing.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="accentLink"
                          >
                            Photos
                          </a>
                        )
                        : null}
                      {listing.photoUrl && listing.quoteUrl && (
                        <span className="separator">·</span>
                      )}
                      {listing.quoteUrl
                        ? (
                          <a
                            href={listing.quoteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="accentLink"
                          >
                            Request Quote
                          </a>
                        )
                        : null}
                      {(listing.photoUrl || listing.quoteUrl) && (
                        <span className="separator">·</span>
                      )}
                      <Link
                        to={`/watches/${event.watchId}`}
                        className="accentLink"
                      >
                        View saved search
                      </Link>
                    </div>

                    {!event.readAt && (
                      <button
                        className="quiet"
                        disabled={busy === event.id}
                        onClick={() => markOne(event.id)}
                      >
                        {busy === event.id ? "Marking read…" : "Mark read"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
    </main>
  );
}
