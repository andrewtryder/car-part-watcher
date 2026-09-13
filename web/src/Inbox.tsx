import { useEffect, useState } from "react";
import {
  markAllRead,
  markRead,
  type Notification,
  notifications,
} from "./api.ts";
export function Inbox() {
  const [all, setAll] = useState(false);
  const [data, setData] = useState<
    { items: Notification[]; unreadCount: number }
  >();
  const load = () => notifications(all).then(setData);
  useEffect(load, [all]);
  return (
    <main className="inbox">
      <a href="/">← Dashboard</a>
      <header>
        <div>
          <p className="eyebrow">NEW PARTS</p>
          <h1>New Parts</h1>
          <p>{data?.unreadCount ?? 0} unread</p>
        </div>
        {data?.unreadCount
          ? (
            <button
              onClick={async () => {
                await markAllRead();
                load();
              }}
            >
              Mark all read
            </button>
          )
          : null}
      </header>
      <p>
        <button onClick={() => setAll(false)}>Unread</button>{" "}
        <button className="quiet" onClick={() => setAll(true)}>All</button>
      </p>
      {!data
        ? <section className="skeleton">Loading…</section>
        : !data.items.length
        ? (
          <section className="empty">
            <h2>You’re all caught up</h2>
          </section>
        )
        : data.items.map((e) => (
          <article className="watch" key={e.id}>
            <span className="badge blue">{e.readAt ? "Read" : "NEW"}</span>
            <h2>{e.payload.listing.title}</h2>
            <p>
              {e.payload.listing.price} · {e.payload.listing.recyclerName}{" "}
              {e.payload.listing.location}
            </p>
            <small>{e.payload.watch.name}</small>
            {!e.readAt && (
              <button
                className="quiet"
                onClick={async () => {
                  await markRead(e.id);
                  load();
                }}
              >
                Mark read
              </button>
            )}
          </article>
        ))}
    </main>
  );
}
