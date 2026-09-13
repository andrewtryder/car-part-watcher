# Reconciliation

A listing is **new** when a watch has never observed it before. `listings` is
global source inventory; `watch_listings` records the many-to-many observation
relationship, so a listing known to one watch may still be new to another.

Manual execution creates a running `search_runs` row, performs the existing
Browserless Car-Part search (following supplied result pages up to 20),
normalizes every result, then reconciles the whole result set in one PostgreSQL
transaction. Known listings receive current mutable values and `last_seen_at`;
new watch/listing relationships determine the new count. Price, description,
grade, recycler contact details, and order do not create a new listing.

A failed browser/search/parser/pagination run is marked failed with a sanitized
error and performs no listing or relationship updates. Repeated pages and
visibly different records sharing one source key fail as identity collisions.
There is deliberately no missing/disappeared inventory logic yet: a failed or
incomplete run is not evidence that a listing disappeared.
