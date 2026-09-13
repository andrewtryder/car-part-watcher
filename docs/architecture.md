# Architecture

Deno Deploy hosts the open console/API and Deno Cron. Manual or scheduled watch
execution uses Browserless → Car-Part → normalized listings → reconciliation →
PostgreSQL (`listings`, `watch_listings`, `search_runs`). After commit, new
listing events enter the PostgreSQL outbox and flow to `LoggingNotifier`. The
application uses `BrowserlessBrowserProvider` over CDP to ordinary headful
Browserless Chrome; we do not operate a separate browser worker or VM.
