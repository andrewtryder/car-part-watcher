# Security

The console uses HTTP Basic Authentication. Local development may explicitly set
`CONSOLE_AUTH_ENABLED=false`. Production must set `APP_ENV=production` and
`CONSOLE_AUTH_ENABLED=true`; Deno Deploy environments are also treated as
deployed production-like environments. Startup fails before serving requests if
authentication is disabled in either environment, or if enabled authentication
lacks `CONSOLE_USERNAME` or `CONSOLE_PASSWORD`.

Credentials are environment-only secrets: they are never sent to React, stored
by frontend code, logged, or committed. Every HTTP route except `GET /health` is
protected server-side before console, database, or Browserless handlers run.
Invalid or absent credentials receive `401` with the standard Basic challenge.

`GET /health` intentionally returns only `{ "ok": true }` without authentication
so platform monitoring can distinguish a live process from a protected console.
Browserless and database credentials remain Deno Deploy secrets and are never
returned by application APIs or logs.
