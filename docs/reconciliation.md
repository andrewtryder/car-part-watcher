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

## Production verification — 2026-09-13

The `Accord Alternator` production watch was run twice through the React UI.
The baseline run `83bdbe16-9c2e-4677-a4d5-b74fabd8129b` completed in about 25
seconds with 4 pages, 177 listings, 177 new-for-watch relationships, and 21
mutable changes. The immediate repeat run
`803c5f94-5fcf-49dc-af01-8364acb3d741` completed in about 27 seconds with 4
pages, 177 listings, 0 new-for-watch relationships, and 21 mutable changes.
This verified that the observed mutable changes did not become false-new
listings.

## Corrected parser and identity-v2 cutover — 2026-09-13

The source table gained an eight-column layout, while the prior positional
parser treated stock and price as shifted fields. Result history was therefore
intentionally reset after deploying the semantic-header parser and migration
`005_corrected_listing_metadata.sql`. Watch definitions and source catalogs
were preserved; only `listings`, `watch_listings`, `search_runs`, and
`notification_events` were cleared.

Car-Part v2 identity is `sellerUserId | stockNumber | partGuid | part` hashed
as `car-part:v2:sha256:<digest>`. Every component is required: unsupported
rows are skipped rather than using a legacy fallback. The CR-V production
baseline fetched eight pages, persisted 272 identified listings, and skipped
the remaining source rows without a complete strong identity. Its immediate
repeat persisted 272 listings with zero new-for-watch relationships.


## Identity-v3 duplicate-notification fix — 2026-09-20

A production CR-V bumper listing (stock `AKJ119`) generated repeated new-part
notifications even though the visible seller, stock number, part, and price were
the same. The v2 identity included Car-Part's opaque `partGuid`, so GUID churn
could split one physical stock item into several durable listings.

Identity v3 uses seller + stock number + normalized part and excludes
`partGuid`. Reconciliation includes a compatibility lookup for existing v2
rows, preferring a legacy row already associated with the current watch. This
keeps established inventory associated during rollout instead of rebaselining
the watch or generating a notification flood.


## Identity-v4 collision fix — 2026-09-25

Scheduled CR-V bumper runs began failing on 2026-09-21 with
`LISTING_IDENTITY_COLLISION`. Identity v3 intentionally ignored
`partGuid`, but seller + stock number + part was not sufficient to distinguish
all visible vehicles returned by Car-Part.

Identity v4 adds normalized year and make/model to the durable key while
continuing to exclude opaque GUIDs. Legacy v2/v3 rows are reused only when
seller, stock number, year, make/model, and part match, preserving existing
watch associations without silently merging distinct vehicles. Collision errors
now include normalized existing/incoming signatures to make any future identity
incident diagnosable from run history.
