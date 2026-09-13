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
