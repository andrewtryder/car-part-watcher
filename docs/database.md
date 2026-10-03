# Database

PostgreSQL stores durable application state. `deno task migrate` applies
ordered, transactional SQL migrations and records them in `schema_migrations`;
deployment invokes it before release. Local development supplies `DATABASE_URL`
directly or through a Deploy tunnel.

## Durable data

- `watches` stores search intent, scheduling, and notification policy;
  `source_catalogs` stores source options as JSONB.
- `listings` is global inventory keyed by `(source, source_key)`;
  `watch_listings` records per-watch observations. Deleting a watch removes its
  relationships and runs, not global listing history.
- `search_runs` records manual and scheduled execution outcomes.
- `notification_events` stores immutable facts. Each event has inbox state in
  `notification_inbox_state` and may have channel delivery state in
  `notification_deliveries`.

Inbox and delivery rows cascade when their event is deleted. Delivery claiming
is indexed by status and availability; unread inbox state is indexed separately.
Session IDs, cookies, Browserless state, opaque interchange values, and selector
internals are never persisted.

## Migration safety

Migrations must work for empty databases and the immediately preceding schema.
The notification-state split preserves legacy read metadata as inbox state and
delivery/retry metadata as delivery state while retaining legacy columns
temporarily for deployment compatibility. Current code reads and writes only the
separated tables.

Historical deployment evidence is in
[history/production-verification.md](history/production-verification.md).
