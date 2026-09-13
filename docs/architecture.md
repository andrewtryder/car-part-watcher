# Architecture

Browser → Deno Deploy web console/API → managed Prisma Postgres. Deno Deploy
uses `BrowserlessBrowserProvider` over CDP to ordinary headful Browserless
Chrome, which performs the existing Car-Part Playwright flow. We do not operate
a separate browser worker or VM.
