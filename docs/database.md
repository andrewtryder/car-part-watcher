# Database

Deno Deploy managed Prisma Postgres is assigned to this application and injects
`DATABASE_URL` plus standard `PG*` variables. `deno task migrate` applies
ordered transactional SQL migrations and tracks them in `schema_migrations`;
Deploy runs it as the pre-deploy command. Local development may set
`DATABASE_URL` or use a Deploy tunnel. `source_catalogs` stores source metadata
as JSONB; `watches` stores durable, human-readable search intent and refinement
labels. Session IDs, opaque interchange values, cookies, Browserless state, and
selector internals are intentionally never persisted.
