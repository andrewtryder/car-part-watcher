# Architecture

Deno Deploy hosts the React/Vite/Tailwind console assets, API, and Deno Cron. The
browser loads the SPA and uses only `/api/*`; React never receives database or
Browserless credentials. Manual or scheduled watch
execution uses Browserless → Car-Part → normalized listings → reconciliation →
PostgreSQL (`listings`, `watch_listings`, `search_runs`). After commit, new
listing events enter the PostgreSQL outbox and flow to `LoggingNotifier`. The
application uses `BrowserlessBrowserProvider` over CDP to ordinary headful
Browserless Chrome; we do not operate a separate browser worker or VM.

## Listing source data policy

`listings` persists corrected Car-Part metadata: `damage_code`, `image_url`,
`photo_url`, and sanitized `quote_url`. Quote URLs omit source transient
parameters (`tk1`–`tk6`, `seqNum`, `sessionID`, and `userUID`). A stable
canonical listing URL was not observed, so the application does not invent
one. Identity v2 requires seller, stock, part GUID, and part; rows missing any
one of these strong components are deliberately not persisted.
