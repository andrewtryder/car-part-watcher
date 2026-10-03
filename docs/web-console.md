# Web console

The React/TypeScript/Vite SPA lives in `web/src`; Vite emits `web/dist`, served
by Deno while `/api/*` remains backend-owned. Run `deno task web:dev` beside
`deno task serve` locally; Vite proxies API requests. `deno task web:build`
produces assets and `deno task ci` is the canonical quality gate.

Dashboard shows watch, run, catalog, and notification summaries. Saved Searches
supports create, edit, detail, manual execution, and scheduling. New Parts
presents notification events with independent read state and watch/type filters.
Global and per-watch run history show execution outcomes.

Browser-native HTTP Basic Authentication protects the SPA and API when enabled;
the frontend never stores or injects credentials. `GET /health` is the only
public route. See [security.md](security.md) for access policy.
