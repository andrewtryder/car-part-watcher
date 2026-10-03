# Security

The console uses HTTP Basic Authentication. Authentication is enabled by
default in every environment: if `CONSOLE_AUTH_ENABLED` is unset, the server
requires `CONSOLE_USERNAME` and `CONSOLE_PASSWORD` before startup completes.

Set `CONSOLE_AUTH_ENABLED=false` explicitly to disable Basic Authentication.
That opt-out applies to the entire console boundary, including SPA assets and
`/api/*` routes, so an unauthenticated browser can still use the application.
Only use the opt-out when making the operational console intentionally public.

When authentication is enabled, credentials are environment-only secrets: they
are never sent to React, stored by frontend code, logged, or committed. Every
HTTP route except `GET /health` is protected server-side before console,
database, or Browserless handlers run. Invalid or absent credentials receive
`401` with the standard Basic challenge.

`GET /health` intentionally returns only `{ "ok": true }` without
authentication so platform monitoring can distinguish a live process from a
protected console. Browserless and database credentials remain Deno Deploy
secrets and are never returned by application APIs or logs.
