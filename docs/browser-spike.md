# Car-Part browser-search spike

## Outcome

**Local execution succeeded.** The Deno/Playwright spike used a single, headed,
normal Chrome context to execute the representative 2015 Honda Accord alternator
search, choose `2.4L (Mitsubishi manufacturer), AT (CVT)` by visible label, and
parse 50 first-page listings. It recognized that a further results page exists.

**Deno Deploy direct Chromium launch failed concretely.** The temporary
protected preview endpoint loaded the Deno application and Playwright package,
then returned `BROWSER_LAUNCH_FAILED`:
`Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`. Per
the spike constraints, no attempt was made to install, bundle, or otherwise work
around a browser binary on the platform.

## Local execution

- Deno: `2.9.6` (Deno 2.x)
- Playwright: `npm:playwright@1.58.2`
- HTML parser: `npm:linkedom@0.18.12`
- Browser: locally installed Google Chrome, launched through Playwright's
  `channel: "chrome"`

Run the spike once:

```sh
deno task search:spike
```

The task needs read/write/run/sys permissions because Playwright queries host
information, launches a browser process, and creates a temporary browser
profile. It writes only structured JSON to stdout. It does not log cookies,
`tk*`, session IDs, or full HTML. Quote URLs are sanitized to remove transient
`tk*` and sequence parameters.

The default is **headed Chrome**. This is deliberate:
`PLAYWRIGHT_HEADLESS=true deno task search:spike` received Car-Part's normal
access challenge and the code returned `ACCESS_CHALLENGE` without trying to
bypass it. The headed normal-browser run completed successfully. No stealth
tooling, proxy, CAPTCHA solver, or fingerprint modification is used.

Offline parser tests:

```sh
deno task test
deno task check
```

The tests use only small sanitized fragments and make no live requests.

## Search implementation

`src/browser/car_part_browser.ts` owns browser navigation. The parser modules
operate on HTML strings:

- `src/parsers/search_options.ts` returns option `{ label, value }` pairs for
  years, combined make/models, parts, locations, and sorts.
- `src/parsers/refinement.ts` extracts only human-visible radio labels. The
  browser locates the configured label, checks its supplied radio input, and
  submits the page's form; it never reconstructs the opaque interchange value.
- `src/parsers/results.ts` finds the server-rendered table with `Stock#`, parses
  listing cells, and exposes available quote/image identifiers. It also
  identifies supplied `userPage=N` links.

Page classification is structural, not URL-based: a `#MainForm` with `dummyVar`
radios is a refinement page; a table containing `Stock#` is a results page. A
Cloudflare challenge page is classified as `ACCESS_CHALLENGE` before form
interaction continues.

The development-only endpoint is `POST /_dev/search-spike`. It is intentionally
unavailable unless `SEARCH_SPIKE_TOKEN` is set and the request has exactly
`Authorization: Bearer <SEARCH_SPIKE_TOKEN>`. It is temporary and is not a
public search API.

## Result parser

Each normalized listing can include vehicle year/part/make-model, description,
grade, stock number, displayed/numeric USD price, recycler name/location/phone,
and identifiers observed in image or quote links:

- `sellerUserId`
- `partSourceId`
- `partGuid`
- `vehicleGuid`
- sanitized `quoteUrl`
- `imageUrl`

Not every listing exposes every field. These are observations, not an identity
algorithm: stock number alone remains non-global, and GUID stability across
price changes or compatible searches has not been proven.

## Deno Deploy experiment

### What was verified

Current official Deno Deploy documentation says the platform uses standard Deno
in a Linux isolated environment and supports NPM dependencies, filesystem
access, subprocesses, and native addons. It also explicitly says the exact
installed tools are subject to change and cannot be relied upon. See
[Deno Deploy runtime documentation](https://docs.deno.com/deploy/reference/runtime/).

The current Deploy CLI uses `DENO_DEPLOY_TOKEN`, not `DENO_DEPLOY_API_KEY`. For
this experiment only, the provided local value was passed to the CLI as
`DENO_DEPLOY_TOKEN` without printing it. It authenticated successfully after the
Deploy organization/app was created. A protected preview endpoint was deployed
and invoked once.

### Explicit answers

1. **Can Chromium launch directly inside current Deno Deploy?** No, not with
   this implementation's normal Playwright Chrome channel. The platform returned
   `Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`.
2. **If yes, how is the browser binary supplied?** Not applicable. No browser
   binary was supplied or assumed. The runtime documentation says installed
   tools can change, so depending on a system browser would not be supportable
   anyway.
3. **Required launch configuration?** No working direct-launch configuration was
   established. Local Chrome uses Playwright `channel: "chrome"` and a headed
   context; that is not a portable Deploy configuration.
4. **If no, what exact failure occurs?** The deployed endpoint returned HTTP
   `502` with structured `BROWSER_LAUNCH_FAILED`; Playwright's cause was
   `Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`
   and suggested `npx playwright install chrome`.
5. **Would remote Playwright/CDP be the clean alternative?** Yes.
   `BrowserProvider` / `BrowserSession` isolates browser creation. A future
   `RemoteBrowserProvider` can connect to an approved externally hosted
   Playwright/CDP browser, while Deno Deploy hosts the protected endpoint and
   parsing orchestration. No external browser service or credentials were added
   in this spike.

To continue this experiment, grant this Deploy account access to an
organization/app (or provide its organization and app name), set a
deployment-only `SEARCH_SPIKE_TOKEN`, deploy a preview using the current
`@deno/deploy` CLI, and invoke the protected endpoint once. If the deployed
runtime lacks a usable Chromium binary or display/dependencies, record that
concrete startup error and use the remote provider boundary instead of
attempting workarounds.

## Remaining risks

- Car-Part may challenge headless or hosted browser sessions. The spike stops
  with `ACCESS_CHALLENGE`; it must not evade that control.
- The site can change its form/table selectors and human-visible refinement
  label.
- The exact configured refinement can disappear; the spike returns
  `REFINEMENT_OPTION_NOT_FOUND` with current labels rather than guessing.
- Listing identity is still an observed set of fields, not a durable uniqueness
  guarantee.
- A remote Playwright/CDP browser still needs to be selected and its timeout,
  authentication, and browser-session behavior validated. Direct Chrome launch
  on this Deno Deploy runtime is not viable with the normal installed-browser
  channel.

## Lightweight Browser Experiment

The lightweight experiments reused the same browser-flow code, selectors,
visible-label refinement choice, structural page classification, and terminal
error taxonomy. They did not change headers, browser fingerprints, proxies, or
challenge behavior.

### Lightpanda 0.4.0

The provider in `src/browser/lightpanda_browser_provider.ts` runs Lightpanda's
CDP server and connects through `npm:playwright-core@1.58.2`; it does not use
the full Playwright browser download. The executable version, Linux asset names,
and SHA-256 digests are pinned in source. On Linux it chooses the asset from
`Deno.build.arch`, streams it to a per-run temporary directory, verifies its
SHA-256 before execution, and removes it when the session closes. There is no
mutable "latest" URL or unchecked download path. See Lightpanda's
[CDP quickstart](https://lightpanda.io/docs/quickstart) and
[0.4.0 release](https://github.com/lightpanda-io/browser/releases/tag/v0.4.0).

| Environment                                           | Observed stages / outcome                                                                                                                                                                                                                                                                                                                                            | Classification                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Local macOS arm64                                     | CDP server started; `connectOverCDP`, homepage load, search-option parse all succeeded. The unmodified initial image-submit action timed out because Lightpanda reported it outside the viewport. The structured result was `FORM_SUBMIT_FAILED`; no access challenge was detected.                                                                                  | Partially compatible                  |
| Deno-native command                                   | `LIGHTPANDA_PATH=/path/to/lightpanda deno task lightpanda:spike` reached the same `FORM_SUBMIT_FAILED` stage.                                                                                                                                                                                                                                                        | Partially compatible                  |
| Deno Deploy (Linux x86_64, observed via `Deno.build`) | The first implementation buffered the approximately 171 MB Linux x86_64 binary and exceeded the memory limit before launch. After changing to streamed download and incremental SHA-256 verification, a protected request received no bytes within 25 seconds. Worker logs showed only worker startup, so executable start and CDP connection were **not observed**. | Incompatible for this deployment path |

The current protected endpoint also supports
`POST /_dev/search-spike?runtime=info` and returns only `Deno.build.os` and
`Deno.build.arch` after the same bearer-token check. This records the Deploy
architecture before selecting an asset; it does not expose a browser service or
credentials.

Rough comparison: the verified macOS arm64 Lightpanda 0.4.0 release asset was
about 83 MB; the pinned Linux x86_64 release asset was about 171 MB. Local
Lightpanda reached the form interaction in roughly the normal 30-second locator
timeout window, versus the successful headed local Chrome flow which completed
in a few seconds. Browser RSS was not treated as a reliable comparison because
the experiments were run in different runtimes and no dedicated benchmark
harness was introduced.

### Happy DOM 20.14.3

One bounded live experiment used Happy DOM with JavaScript evaluation enabled.
It loaded the homepage, title, five selects, and main form without a challenge.
Setting the same form values and clicking the existing image submit did not
produce navigation within 15 seconds (`FORM_NAVIGATION_TIMEOUT`). The experiment
stopped there: no synthetic submit, no alternate transport, and no retry loop.

Classification: **Partially compatible** for a homepage/document check, but
unsuitable for the live Car-Part browser flow. It can still be useful for parser
or DOM-oriented tests; it is not recommended as the watcher runtime. See
[Happy DOM's browser API documentation](https://github.com/capricorn86/happy-dom/wiki/Browser).

### Decision

**C — use full headed Chrome remotely.** The local normal-browser flow is the
only end-to-end success. Lightpanda is promising for page loading and CDP
attachment but currently fails the site's native image-submit interaction, while
downloading its large Linux executable in Deno Deploy did not reach a usable
browser within the request window. Happy DOM cannot complete ordinary
navigation. Keep the existing `BrowserProvider` boundary and add a remote
headed-Chrome/CDP provider only after choosing an approved browser host.
