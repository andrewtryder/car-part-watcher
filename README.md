<p align="center">
  <img src="web/public/car-part-watcher-logo.svg" alt="Car Part Watcher" width="720" />
</p>

<p align="center">
  A Deno-powered operations console for saved Car-Part searches, scheduled inventory checks, listing reconciliation, and new-part notifications.
</p>

## What it does

Car Part Watcher runs saved vehicle-part searches against Car-Part, normalizes
and reconciles the returned inventory, tracks new and changed listings, and
surfaces run history and notification activity in a React operations console.

- Saved searches with manual and scheduled execution
- Browserless-powered Car-Part search automation
- Durable PostgreSQL listing reconciliation and run history
- New/changed listing notifications with an outbox-based delivery flow
- React/Vite web console for search health, results, and operations

## Development

```sh
deno task web:dev
deno task serve
```

The Vite development server proxies `/api` to the local Deno application.

Useful verification commands:

```sh
deno task ci       # Run the canonical quality gate (fmt, lint, type check, tests, build)
deno task verify   # Alias for deno task ci
deno task test     # Run unit tests
deno task fmt      # Format codebase
deno task lint     # Lint codebase
```

For guidelines on repository hygiene, Conventional Commits, local Git hooks, and
releases, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Deployment

The application is configured for Deno Deploy in `deno.json`. Production builds
execute the canonical verification gate (`deno task ci`) and the
source-controlled database migration step (`deno task migrate`) before deploying
the new revision.

Console authentication is enabled by default. When enabled, deployments must
provide the `CONSOLE_USERNAME` and `CONSOLE_PASSWORD` secrets. To intentionally
make the operational console and its API public, set
`CONSOLE_AUTH_ENABLED=false`. See
[security documentation](docs/security.md).

## Documentation

- [Architecture](docs/architecture.md), [database](docs/database.md), and
  [security](docs/security.md)
- [Reconciliation](docs/reconciliation.md) and
  [listing identity](docs/listing-identity.md)
- [Notifications](docs/notifications.md), [scheduling](docs/scheduling.md), and
  [web console](docs/web-console.md)
- Historical rollout evidence and incidents live in
  [docs/history](docs/history/).
