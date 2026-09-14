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

The optional single-user access control is browser-native HTTP Basic Authentication.
There is no React login screen and the frontend does not store or inject
credentials. Once the browser authenticates the same-origin SPA, its existing
API calls continue normally. `GET /health` is the only public route; all SPA
routes, assets, read APIs, and mutations require the Deno Deploy
`CONSOLE_USERNAME` and `CONSOLE_PASSWORD` secrets when
`CONSOLE_AUTH_ENABLED=true`; it defaults to false.

## Production verification — 2026-09-13

Revision `qq3bc297t2fn` of commit
`82ef5e33cca1402efa5f4d0d024b475e25fe1ae2` was verified at
the production console through a Browserless-driven
React UI session. The real watch `Accord Alternator`
(`cb40e731-2162-4f9a-8a9b-78f7705a785e`) is enabled and scheduled twice daily
in `America/New_York`. Watch Detail, Saved Searches, global Run History, and
the watch-filtered New Parts view all displayed its production state correctly.

## Real inventory monitoring — 2026-09-13

The production React create flow now also monitors a real wanted part:
`CRV Front Bumper` (`14337db6-b793-4228-804e-dacd52baeb5d`). Its persisted
criteria are `2019` / `Honda CRV` / `Bumper Assy (Front) includes cover`, with
the live all-areas catalog value `All States`, distance sort (`zip`), postal
code `03873`, and refinement `fog lamps`. The UI preserved the postal code's
leading zero. The watch is enabled, runs three times daily in
`America/New_York`, and suppresses notifications on its first successful run.

Two bounded React-initiated runs completed successfully: the baseline fetched
8 pages and reconciled 41 new-for-watch listings in about 22 seconds without
creating New Parts events; the repeat fetched 8 pages and found zero new
listings in about 21 seconds (41 mutable listing updates). The watch remains
active for real inventory monitoring. The next expected natural observations
are its first scheduled run and its first genuinely new matching listing.

At the measured roughly 22 seconds per search, a three-times-daily watch is
about 90 Browserless sessions or 33 browser-minutes per 30-day month before
retries and ad-hoc use. The configured Browserless regional endpoint did not
expose account usage statistics through its read-only `/stats` route, and no
plan or provider settings were changed. Production log review for the two
runs returned no error entries (only a runtime startup entry).

## Corrected listing metadata — 2026-09-13

Watch Detail now renders semantic damage, grade, stock number, and price from
the corrected Car-Part result columns, rather than displaying a stock number as
a price. It also renders source thumbnails where available and exposes only
the source-provided `Photos` and `Request Quote` actions. Both open in a new
tab with `noopener noreferrer`; there is intentionally no invented canonical
"View Listing" URL.

The current production `CR-V Bumper` watch uses the preserved criteria
`2019` / `Honda CRV` / `Bumper Assy (Front) includes cover` / `All States` /
ZIP `03873` / `fog lamps`. After the result-history reset, its 272-listing
baseline and zero-new repeat were run through the React UI. The currently
preserved schedule is enabled once daily, not the older three-times-daily
configuration recorded above.
