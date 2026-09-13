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
means unread `new_listing` notification events (`read_at is null`). The React
console includes Dashboard, Saved Searches create/edit/detail, New Parts with
read state and watch filtering, and global/per-watch run history. It remains
intentionally unauthenticated and must not be shared publicly until access
control is added.

## Production verification — 2026-09-13

Revision `qq3bc297t2fn` of commit
`82ef5e33cca1402efa5f4d0d024b475e25fe1ae2` was verified at
`https://car-part-watcher.andrewtryder.deno.net` through a Browserless-driven
React UI session. The real watch `Accord Alternator`
(`cb40e731-2162-4f9a-8a9b-78f7705a785e`) is enabled and scheduled twice daily
in `America/New_York`. Watch Detail, Saved Searches, global Run History, and
the watch-filtered New Parts view all displayed its production state correctly.
