# Database

Deno Deploy managed Prisma Postgres (`car-part-watcher-postgres`) is assigned to
this application and injects `DATABASE_URL` plus standard `PG*` variables.
`deno task migrate` applies ordered transactional SQL migrations and tracks them
in `schema_migrations`; source-controlled `deploy.predeploy = "deno task
migrate"` runs it before deployment. Repository deploy configuration takes
precedence over dashboard build configuration when present. Local development
may set `DATABASE_URL` or use a Deploy tunnel. `source_catalogs` stores source
metadata as JSONB; `watches` stores durable, human-readable search intent and
refinement labels. Session IDs, opaque interchange values, cookies, Browserless
state, and selector internals are intentionally never persisted.

`002_listing_reconciliation.sql` adds global `listings` (`source`, `source_key`
unique), per-watch `watch_listings`, and `search_runs`. Deleting a watch removes
only its relationships and runs, not the global listing. Indexes support watch
run history and last-seen inspection.

## Deployment verification

Production revision `aherdknfyxzr` routed on 2026-09-13 with the
source-controlled pre-deploy migration configuration. Build logs showed
`Running pre-deploy command "deno task migrate"` and successful completion for
both the Production and main-branch partitions; the rerun reported the existing
`schema_migrations` relation and completed successfully. The subsequent catalog
refresh succeeded, demonstrating that `schema_migrations`, `source_catalogs`,
and `watches` are available to the application. It stored a catalog with 128
years, 1,670 make/models, 707 parts, 96 locations, and 5 sorts. A representative
watch was created with the human-readable `2.4L (Mitsubishi manufacturer), AT
(CVT)` refinement label, edited, disabled, enabled, and deleted. A second
temporary watch and the cached catalog remained available after production
revision `n0x52twapy2z` routed, confirming PostgreSQL persistence across a
revision change.

The managed-database CLI query endpoint returned an upstream
`databases.executeQuery` procedure-not-found error during this verification, so
schema verification used the application’s normal persisted catalog and watch
operations instead. No diagnostic endpoint was added.

## Listing reconciliation verification

Deploy build revision `7rwq50evdqey` applied
`002_listing_reconciliation.sql`. A temporary Accord Alternator watch ran twice
through Browserless: run `32c2b487-69af-4f40-ba1d-17676d4fd2fd` found 177
listings across 4 pages and created 177 watch/listing relationships in 24.2 s;
run `7c88e545-54f7-40ee-9728-5a8d524cfd11` found the same 177 listings across
4 pages in 23.7 s with zero new relationships and 21 mutable updates. The
temporary watch was deleted afterwards; global listing history was retained.
