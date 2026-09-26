<p align="center">
  <img src="web/public/car-part-watcher-logo.svg" alt="Car Part Watcher" width="720" />
</p>

<p align="center">
  A Deno-powered operations console for saved Car-Part searches, scheduled inventory checks, listing reconciliation, and new-part notifications.
</p>

## What it does

Car Part Watcher runs saved vehicle-part searches against Car-Part, normalizes and reconciles the returned inventory, tracks new and changed listings, and surfaces run history and notification activity in a React operations console.

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

Useful checks:

```sh
deno task test
deno task build
```

## Deployment

The application is configured for Deno Deploy in `deno.json`. Production builds run the web build and the source-controlled database migration step before routing the new revision.

More implementation detail is available in the `docs/` directory.
