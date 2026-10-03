# Reconciliation

Reconciliation converts a successful Car-Part result set into durable inventory.
A listing is **new** when its watch has no existing `watch_listings`
relationship; a listing known to another watch can still be new to this one.

## Identity and changes

The global listing identity is defined in
[listing-identity.md](listing-identity.md). Mutable metadata—price, description,
grade, recycler details, photos, quote URLs, and order—does not make a listing
new. Repeated pages or visibly different rows sharing one source key fail as
identity collisions. Missing inventory is not inferred from incomplete or failed
searches.

## Atomic result handling

A run starts as `running`. After browser search and normalization complete, one
PostgreSQL transaction upserts listings, records observations, updates mutable
fields and `last_seen_at`, creates applicable notification event/inbox/delivery
state, and completes the search run. If persistence fails, that transaction
rolls back; failed browser, parser, pagination, or persistence runs record a
sanitized failure without partially reconciling inventory.

With `notifyOnInitialRun=false`, the first successful baseline creates no event,
inbox state, or delivery. Thereafter detected new/updated facts create immutable
events and inbox rows; per-watch delivery policy only decides whether email
delivery is created.

Historical cutovers and identity incidents are in
[history/reconciliation-history.md](history/reconciliation-history.md).
