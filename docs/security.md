# Security

The single-user console uses HTTP Basic Authentication. Deno Deploy provides
the `CONSOLE_USERNAME` and `CONSOLE_PASSWORD` secrets; credentials are never
sent to React, stored by frontend code, logged, or committed. Every HTTP route
except `GET /health` is protected server-side before console, database, or
Browserless handlers run. Invalid or absent credentials receive `401` with the
standard Basic challenge. If either secret is missing, protected routes fail
closed with a generic `503` response.

`GET /health` intentionally returns only `{ "ok": true }` without
authentication so platform monitoring can distinguish a live process from a
protected console. Browserless and database credentials remain Deno Deploy
secrets and are never returned by application APIs or logs.
