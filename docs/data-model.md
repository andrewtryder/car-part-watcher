# Data model and reconciliation

Persistence uses Deno KV assigned to the Deno Deploy application. Values are
stored under four key namespaces:

- `watches/<id>`: name, enabled state, normalized request fields, source,
  created and updated timestamps.
- `listings/car-part/<sourceKey>`: stable application ID, source identifiers,
  normalized listing payload, and first/last-seen timestamps.
- `watch_listings/<watchId>/<listingId>`: many-to-many listing membership with
  first/last-seen timestamps and the most recent search-run ID.
- `search_runs/<id>`: watch ID, lifecycle timestamps, status, counts, and a safe
  structured failure code/message.

Raw HTML, Car-Part session data, opaque interchange strings, cookies, and
quote-token parameters are not persisted.

## Manual execution

`POST /_dev/watches` creates a watch from a normalized search request.
`POST
/_dev/watches/<id>/run` invokes the remote `PartsSource`; both require
`Authorization: Bearer <MANUAL_RUN_TOKEN>`. A successful response includes the
total result count, counts of new and updated records, and `newListings` for a
future notification boundary. There is no cron or notification code.

For each successful source result, reconciliation calculates the documented
source key, upserts allowed mutable listing fields, and creates a join record
only if that watch has not seen the listing before. A listing is **new** exactly
when that join record is new—not when price, grade, description, ordering, or
browser session changes. The same listing can therefore be new to two separate
watches.

Source search runs are recorded as `failed` before any reconciliation writes
occur. A failed search never alters unseen listing timestamps, declares a
disappearance, or creates new-listing events. Disappearance detection is
intentionally not implemented.
