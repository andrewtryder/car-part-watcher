# Architecture

Watch → Manual Run → Browserless → Car-Part → normalized listings →
reconciliation → managed Prisma Postgres → new listings. The Deno Deploy web
console/API uses `BrowserlessBrowserProvider` over CDP to ordinary headful
Browserless Chrome, which performs the existing Car-Part Playwright flow. We do
not operate a separate browser worker or VM.
