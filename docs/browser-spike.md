# Car-Part browser-search spike

## Outcome

**Local execution succeeded.** The Deno/Playwright spike used a single, headed, normal Chrome context to execute the representative 2015 Honda Accord alternator search, choose `2.4L (Mitsubishi manufacturer), AT (CVT)` by visible label, and parse 50 first-page listings. It recognized that a further results page exists.

**Current Deno Deploy execution was not attempted because the supplied credential authenticates to an account with zero reachable Deploy organizations.** That prevents creation or selection of an application. The current platform is therefore not yet a verified Chromium host for this project.

## Local execution

- Deno: `2.9.6` (Deno 2.x)
- Playwright: `npm:playwright@1.58.2`
- HTML parser: `npm:linkedom@0.18.12`
- Browser: locally installed Google Chrome, launched through Playwright's `channel: "chrome"`

Run the spike once:

```sh
deno task search:spike
```

The task needs read/write/run/sys permissions because Playwright queries host information, launches a browser process, and creates a temporary browser profile. It writes only structured JSON to stdout. It does not log cookies, `tk*`, session IDs, or full HTML. Quote URLs are sanitized to remove transient `tk*` and sequence parameters.

The default is **headed Chrome**. This is deliberate: `PLAYWRIGHT_HEADLESS=true deno task search:spike` received Car-Part's normal access challenge and the code returned `ACCESS_CHALLENGE` without trying to bypass it. The headed normal-browser run completed successfully. No stealth tooling, proxy, CAPTCHA solver, or fingerprint modification is used.

Offline parser tests:

```sh
deno task test
deno task check
```

The tests use only small sanitized fragments and make no live requests.

## Search implementation

`src/browser/car_part_browser.ts` owns browser navigation. The parser modules operate on HTML strings:

- `src/parsers/search_options.ts` returns option `{ label, value }` pairs for years, combined make/models, parts, locations, and sorts.
- `src/parsers/refinement.ts` extracts only human-visible radio labels. The browser locates the configured label, checks its supplied radio input, and submits the page's form; it never reconstructs the opaque interchange value.
- `src/parsers/results.ts` finds the server-rendered table with `Stock#`, parses listing cells, and exposes available quote/image identifiers. It also identifies supplied `userPage=N` links.

Page classification is structural, not URL-based: a `#MainForm` with `dummyVar` radios is a refinement page; a table containing `Stock#` is a results page. A Cloudflare challenge page is classified as `ACCESS_CHALLENGE` before form interaction continues.

The development-only endpoint is `POST /_dev/search-spike`. It is intentionally unavailable unless `SEARCH_SPIKE_TOKEN` is set and the request has exactly `Authorization: Bearer <SEARCH_SPIKE_TOKEN>`. It is temporary and is not a public search API.

## Result parser

Each normalized listing can include vehicle year/part/make-model, description, grade, stock number, displayed/numeric USD price, recycler name/location/phone, and identifiers observed in image or quote links:

- `sellerUserId`
- `partSourceId`
- `partGuid`
- `vehicleGuid`
- sanitized `quoteUrl`
- `imageUrl`

Not every listing exposes every field. These are observations, not an identity algorithm: stock number alone remains non-global, and GUID stability across price changes or compatible searches has not been proven.

## Deno Deploy experiment

### What was verified

Current official Deno Deploy documentation says the platform uses standard Deno in a Linux isolated environment and supports NPM dependencies, filesystem access, subprocesses, and native addons. It also explicitly says the exact installed tools are subject to change and cannot be relied upon. See [Deno Deploy runtime documentation](https://docs.deno.com/deploy/reference/runtime/).

The current Deploy CLI uses `DENO_DEPLOY_TOKEN`, not `DENO_DEPLOY_API_KEY`. For this experiment only, the provided local value was passed to the CLI as `DENO_DEPLOY_TOKEN` without printing it. It authenticated successfully, but reported **0 reachable organizations**. As a result there is no target organization/app and no deployment URL on which to test package download size, Linux browser dependencies, Chromium launch, writable temporary filesystem behavior, or request limits.

### Explicit answers

1. **Can Chromium launch directly inside current Deno Deploy?** Unknown for this account/project: no Deploy app could be created due to zero reachable organizations. It must not be assumed from subprocess support alone.
2. **If yes, how is the browser binary supplied?** Not established. Do not rely on a preinstalled system browser; the runtime documentation says installed tools can change.
3. **Required launch configuration?** Not established on Deploy. Local Chrome uses Playwright `channel: "chrome"` and a headed context; this is not a portable Deploy configuration.
4. **If no, what exact failure occurs?** No Chromium failure was reached. The exact blocking response was: authenticated account with `0 reachable organizations`.
5. **Would remote Playwright/CDP be the clean alternative?** Yes. `BrowserProvider` / `BrowserSession` isolates browser creation. A future `RemoteBrowserProvider` can connect to an approved externally hosted Playwright/CDP browser, while Deno Deploy hosts the authenticated temporary endpoint and parsing orchestration. No external browser service or credentials were added in this spike.

To continue this experiment, grant this Deploy account access to an organization/app (or provide its organization and app name), set a deployment-only `SEARCH_SPIKE_TOKEN`, deploy a preview using the current `@deno/deploy` CLI, and invoke the protected endpoint once. If the deployed runtime lacks a usable Chromium binary or display/dependencies, record that concrete startup error and use the remote provider boundary instead of attempting workarounds.

## Remaining risks

- Car-Part may challenge headless or hosted browser sessions. The spike stops with `ACCESS_CHALLENGE`; it must not evade that control.
- The site can change its form/table selectors and human-visible refinement label.
- The exact configured refinement can disappear; the spike returns `REFINEMENT_OPTION_NOT_FOUND` with current labels rather than guessing.
- Listing identity is still an observed set of fields, not a durable uniqueness guarantee.
- Deno Deploy Chromium viability, deployment package size, resource/time limits, and temp-filesystem behavior remain unverified until the account has a reachable Deploy app.
