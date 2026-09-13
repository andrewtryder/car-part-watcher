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

export function Inbox() {
  const [params, setParams] = useSearchParams();
  const all = params.get("status") === "all";
  const watchId = params.get("watchId") ?? "";
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
      setData(await notifications({ all, watchId: watchId || undefined }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load new parts.",
      );
    }
  }, [all, watchId]);
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
        <div>
          <p className="eyebrow">NOTIFICATIONS</p>
          <h1>New Parts</h1>
          <p className="muted">
            {data
              ? data.unreadCount
                ? `${data.unreadCount} unread`
                : "No unread parts"
              : "Loading unread count…"}
          </p>
        </div>
        {data?.unreadCount
          ? (
            <button disabled={busy === "all"} onClick={markAll}>
              {busy === "all"
                ? "Marking read…"
                : watchId
                ? "Mark All Read for This Search"
                : "Mark All Read"}
            </button>
          )
          : null}
      </header>
      <section className="panel inboxControls">
        <div className="tabs" aria-label="Notification status">
          <button
            className={!all ? "activeTab" : "quiet"}
            onClick={() => update("status", "")}
          >
            Unread
          </button>
          <button
            className={all ? "activeTab" : "quiet"}
            onClick={() => update("status", "all")}
          >
            All
          </button>
        </div>
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
            <h2>Could not load new parts.</h2>
            <p>{error}</p>
            <button onClick={load}>Retry</button>
          </section>
        )
        : !data
        ? <section className="skeleton">Loading new parts…</section>
        : !data.items.length
        ? (
          <section className="empty">
            <h2>{all ? "No parts yet" : "You’re all caught up"}</h2>
            <p>
              {all
                ? "New parts will appear here after a saved search finds them."
                : "No unread parts."}
            </p>
          </section>
        )
        : (
          <section className="inboxList">
            {data.items.map((event) => {
              const listing = event.payload.listing;
              return (
                <article
                  className={`watch notification ${
                    event.readAt ? "read" : "unread"
                  }`}
                  key={event.id}
                >
                  <div className="watchTop">
                    <span
                      className={`badge ${event.readAt ? "slate" : "blue"}`}
                    >
                      {event.readAt ? "Read" : "NEW"}
                    </span>
                    <small>
                      {event.readAt
                        ? "Read notification"
                        : "Unread notification"}
                    </small>
                  </div>
                  <h2>{listing.title}</h2>
                  {(listing.description || listing.grade ||
                    listing.stockNumber || listing.price) && (
                    <p className="criteria">
                      {joined(
                        listing.price,
                        listing.grade && `Grade ${listing.grade}`,
                        listing.stockNumber && `Stock #${listing.stockNumber}`,
                        listing.description,
                      )}
                    </p>
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
                    <Link to={`/watches/${event.watchId}`}>
                      {event.payload.watch.name}
                    </Link>
                    {" · "}Found {date(event.createdAt, timezone)}
                  </p>
                  <div className="actions">
                    <Link to={`/watches/${event.watchId}`}>
                      View Saved Search
                    </Link>
                    {!event.readAt && (
                      <button
                        className="quiet"
                        disabled={busy === event.id}
                        onClick={() => markOne(event.id)}
                      >
                        {busy === event.id ? "Marking read…" : "Mark Read"}
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
