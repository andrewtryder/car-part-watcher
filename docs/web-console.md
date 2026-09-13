# Web console

The unauthenticated operational console is a React 19 + TypeScript + Vite 8
single-page application styled with Tailwind CSS 4. Source is under `web/src`;
Vite emits `web/dist`, which the Deno HTTP server serves while retaining `/api/*`
for the backend.

Run `deno task web:dev` alongside `deno task serve` for local development. Vite
proxies `/api` to the local Deno server. `deno task web:build` creates the
production assets and `deno task build` also checks the backend. Deploy runs the
web build before the existing `deno task migrate` pre-deploy migration.

The Dashboard uses `GET /api/dashboard`, an aggregate endpoint for watches,
latest and recent runs, catalog health, and notification counts. "New Parts"
means `new_listing` notification events created in the last 24 hours; it does
**not** mean unread. Read/unread and the New Parts inbox are deferred.

Dashboard is the only completed page. Saved Searches, New Parts, Run History,
and Settings are clear navigation placeholders. The console remains intentionally
unauthenticated and must not be shared publicly until access control is added.
