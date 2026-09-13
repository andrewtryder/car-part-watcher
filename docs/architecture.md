# Architecture

Deno Deploy hosts the React/Vite/Tailwind console assets, API, and Deno Cron. The
browser loads the SPA and uses only `/api/*`; React never receives database or
Browserless credentials. Manual or scheduled watch
execution uses Browserless → Car-Part → normalized listings → reconciliation →
PostgreSQL (`listings`, `watch_listings`, `search_runs`). After commit, new
listing events enter the PostgreSQL outbox and flow to `LoggingNotifier`. The
application uses `BrowserlessBrowserProvider` over CDP to ordinary headful
Browserless Chrome; we do not operate a separate browser worker or VM.
