# Browser worker

The browser worker is an internal Docker service, separate from Deno Deploy. Its
image is based on `denoland/deno:2.9.6` for `linux/amd64` and includes Linux,
Xvfb, Google Chrome stable, Deno, and Playwright. The entrypoint runs
`scripts/with-xvfb.sh`, then `deno task worker:serve`. Chrome is launched by the
existing provider with `headless: false`; Xvfb supplies `DISPLAY=:99`.

## API

`GET /health` returns `{ "ok": true }` and does not start Chrome.

`POST /search` accepts a normalized `CarPartSearchRequest` and returns the
existing `SpikeResult` shape (`search`, optional `refinement`, and
`results.count`, `results.hasNextPage`, `results.listings`). It never returns
raw HTML, cookies, request/session tokens, or browser state.

All `/search` requests require `Authorization: Bearer <BROWSER_WORKER_TOKEN>`.
Missing or invalid credentials receive `401`; credentials are neither logged nor
placed in error responses. The comparison hashes both bearer values before
checking equality.

Only one search runs at once. A concurrent request receives `503 WORKER_BUSY`.
Every request creates an isolated browser session; `runCarPartSearch` closes it
in `finally`, including challenge and failure paths. Browser startup has a
20-second limit, ordinary actions have a 20-second limit, navigation has a
25-second limit, and the Deploy client applies a 70-second whole-request limit.

The Deno Deploy application calls this service only over HTTPS JSON via
`CAR_PART_WORKER_URL` and `CAR_PART_WORKER_TOKEN`; it has no Chrome, Xvfb, or
Playwright dependency. Build locally with:

```sh
docker build -f Dockerfile.browser-matrix -t car-part-browser-worker .
docker run --rm -p 8000:8000 -e BROWSER_WORKER_TOKEN=... car-part-browser-worker
```

No proxy, stealth tooling, browser-state reuse, CAPTCHA handling, or identity
modification is configured.
