# Architecture

Deno Deploy hosts the React/Vite/Tailwind console assets, API, and Deno Cron.
The browser loads the SPA and uses only `/api/*`; React never receives database
or Browserless credentials. Manual or scheduled watch execution uses Browserless
→ Car-Part → normalized listings → reconciliation → PostgreSQL (`listings`,
`watch_listings`, `notification_events`, `notification_inbox_state`,
`notification_deliveries`, and `search_runs`). In one atomic transaction,
listing records are upserted, associations created, notification facts and inbox
state persisted, applicable deliveries created, and the search run completed.
Post-commit delivery uses the active notifier (`LoggingNotifier` by default, or
`GmailNotifier` when enabled). Transport failures remain in the durable delivery
retry path without affecting completed runs. The application uses
`BrowserlessBrowserProvider` over CDP to headful Browserless Chrome; we do not
operate a separate browser worker or VM.

The HTTP server uses modular route boundaries under `src/http/*` (`router.ts`,
`watch_handlers.ts`, `notification_handlers.ts`, `catalog_handlers.ts`,
`errors.ts`, and `static_assets.ts`), keeping `main.ts` as a lean composition
root. All deployed environments validate Basic Auth configuration during startup
before HTTP serving begins; only the minimal process health endpoint is public.
Deno Cron does not call HTTP routes: it imports `scheduledWatchDispatcher` and
the outbox processor directly, so scheduled runs are independent of console
credentials. The former HTTP schedule-trigger route was removed rather than
leaving an externally invocable Browserless-search entry point.

## Listing source data policy

`listings` persists corrected Car-Part metadata: `damage_code`, `image_url`,
`photo_url`, and sanitized `quote_url`. Quote URLs omit source transient
parameters (`tk1`–`tk6`, `seqNum`, `sessionID`, and `userUID`). A stable
canonical listing URL was not observed, so the application does not invent one.
Identity v4 requires seller, stock, vehicle (year + make/model), and part
(`seller_stock_vehicle_part`), while deliberately excluding Car-Part's unstable
`partGuid` to prevent churn on identical inventory. Rows missing any one of
these strong components are deliberately not persisted.

The notification delivery worker selects its notifier once per drain. When email
delivery is disabled, `LoggingNotifier` logs event summaries; when configured
and enabled, `GmailNotifier` sends multipart plaintext and HTML emails via Gmail
SMTP using environment-only credentials and DB-managed recipient configuration.
Transport failures remain in the durable delivery retry path.
