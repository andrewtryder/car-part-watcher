# Car-Part browser-search spike

## Current architecture

The completed runtime decision is now implemented as a private browser-worker
boundary. The Deno Deploy application owns API/persistence and invokes the
worker through authenticated HTTPS JSON; it does not launch or control a
browser. The worker owns one isolated, normal headed Chrome session per search.

```text
Deno Deploy
  ├── application/API
  └── Deno KV persistence
          |
          | HTTPS JSON
          v
browser worker
  ├── Linux + Xvfb
  ├── Google Chrome (headless: false)
  └── Playwright
          |
          v
     Car-Part.com
```

The active worker and persistence details are in
[`browser-worker.md`](browser-worker.md) and [`data-model.md`](data-model.md).
Browser-engine experimentation is complete; the historical experiments below are
retained as evidence, not as active implementation options.

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

| Runtime                | Search works                  | Challenge          | Binary/package size                   | Startup                              | Total observed run                 | Subprocesses / RSS                                                                        |
| ---------------------- | ----------------------------- | ------------------ | ------------------------------------- | ------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Local headed Chrome    | Yes, 50 listings              | No                 | Chrome app: about 723 MB on this host | Not separately timed                 | A few seconds                      | Not measured: existing user Chrome processes make a clean RSS/count comparison unreliable |
| Local headless Chrome  | No                            | `ACCESS_CHALLENGE` | Same installation                     | Not separately timed                 | A few seconds to challenge         | Not measured                                                                              |
| Local Lightpanda       | No; stopped at initial submit | No                 | Verified arm64 binary: about 83 MB    | CDP start and attach: about 1 second | About 30 seconds (locator timeout) | One Lightpanda server process; RSS not captured                                           |
| Deno Deploy Lightpanda | No usable result              | Not observed       | Pinned x86_64 download: about 171 MB  | Not observed                         | No response within 25 seconds      | Worker started; executable/RSS/process count not observed                                 |

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

## Remote Headed Chrome Experiment

`BrowserlessBrowserProvider` is the optional remote-hosted Chrome provider. It
is limited to session creation; the existing Car-Part flow, challenge detection,
form handling, and parsing are unchanged. It uses `npm:playwright-core@1.58.2`
with `chromium.connectOverCDP()` and reuses the default Browserless context/page
rather than creating a disconnected context.

### Configuration

- The default region is Browserless US West:
  `wss://production-sfo.browserless.io`; `BROWSERLESS_ENDPOINT` may replace the
  service origin (or its `/chrome` path).
- The provider always selects Browserless's `/chrome` CDP route: ordinary
  licensed Google Chrome, not Chromium.
- It requests `headless=false`, `--window-size=1280,900`, and a 60-second
  Browserless session timeout. Playwright's CDP connection timeout is 15
  seconds.
- `BROWSERLESS_API_KEY` is required and is added only to the connection URL at
  runtime. It is not logged or returned; connection-error sanitization redacts a
  token query value.
- No stealth route, proxy, CAPTCHA solving, BrowserQL, profile, custom
  user-agent, header manipulation, or fingerprint override is configured.

Run the local remote-CDP spike once after setting `BROWSERLESS_API_KEY`:

```sh
deno task browserless:spike
```

It records provider/search stages, coarse creation/CDP/homepage/form/parse/total
timings, and closes the remote browser in `finally`, including for challenges
and failures. Remote provider failures have distinct
`REMOTE_BROWSER_CREATE_FAILED` and `REMOTE_CDP_CONNECTION_FAILED` codes; a
Car-Part challenge remains `ACCESS_CHALLENGE` and carries its current stage.

### Result

On 2026-09-12, the shared-cloud Browserless API key first passed a read-only
`example.com` screenshot check (HTTP 200; the temporary PNG was deleted). One
local remote-CDP run then completed the representative search with ordinary
Chrome, `headless=false`: 50 listings, `hasNextPage: true`, no
`ACCESS_CHALLENGE`, and clean session closure. Timings were 1.5 s CDP connect,
0.8 s homepage, 1.4 s initial submit, 1.5 s refinement submit, 0.2 s parse, and
10.4 s total. No Browserless-specific stealth, proxy, profile, CAPTCHA, or other
identity feature was enabled.

| Runtime                      | Search works                                    | Challenge    | Startup/connect      | Total run     |
| ---------------------------- | ----------------------------------------------- | ------------ | -------------------- | ------------- |
| Local headed Chrome          | Yes, 50 listings                                | No           | Not separately timed | A few seconds |
| Browserless from local Deno  | Yes, 50 listings                                | No           | 1.5 s CDP connect    | 10.4 s        |
| Browserless from Deno Deploy | Not run: local remote success is required first | Not observed | Not observed         | Not observed  |

### Recommendation

Browserless is a working optional remote-browser host for this representative
flow. The self-hosted Linux/Xvfb worker remains the preferred production
boundary because it is already validated and has simpler data/control ownership.

## Chrome Execution Mode Matrix

`deno task browser-matrix -- <mode>` is a development-only live harness. It uses
the existing provider/search/parsers, records its last completed stage and
coarse timings, and is not a CI task. Browser modes are explicit:
`chrome-headed`, `chrome-headless`, `chromium-new-headless`, and
`chromium-headless-shell`. A virtual display is infrastructure, not another
browser mode: Chrome under Xvfb remains `chrome-headed`.

No mode adds stealth, proxying, custom user agents, navigator patches, header
changes, CAPTCHA handling, or fingerprint modifications. An access challenge is
recorded as `ACCESS_CHALLENGE` and that mode is not retried.

| Mode                    | Distribution                                                          | Rendering mode | Environment                  | Result                            | Challenge    | Last stage          | Listings | Total time                     |
| ----------------------- | --------------------------------------------------------------------- | -------------- | ---------------------------- | --------------------------------- | ------------ | ------------------- | -------- | ------------------------------ |
| Chrome headed           | Google Chrome                                                         | headed         | local macOS, real desktop    | Existing successful control       | No           | complete            | 50       | A few seconds (previous spike) |
| Chrome headless         | Google Chrome                                                         | headless       | local macOS                  | Existing failing control          | Yes          | initial form submit | —        | A few seconds (previous spike) |
| Chromium new headless   | Playwright Chromium                                                   | new headless   | local macOS                  | Harness blocked before navigation | Not observed | browser start       | —        | —                              |
| Chromium headless shell | Playwright headless shell (Google Chrome for Testing `151.0.7922.34`) | headless       | local macOS                  | Failed                            | Yes          | initial form submit | —        | 2.4 s                          |
| Chrome + Xvfb           | Google Chrome `153.0.8010.36`                                         | headed         | local Docker: Debian 13/Xvfb | SUCCESS                           | No           | complete            | 50       | 5.8 s                          |

The Chromium-new-headless result is not a Car-Part compatibility result. Its
managed Chrome-for-Testing bundle was incomplete on this host (a required
framework file was missing), so `BROWSER_LAUNCH_FAILED` occurred before any site
request. A repair download made no progress and was stopped. That mode may be
run once after a complete Playwright-managed Chromium installation is available.

The continuation used the pinned package without an upgrade:

```sh
deno run -A npm:playwright@1.58.2 install --no-shell chromium
deno task browser-matrix -- chromium-new-headless --launch-only
```

The installation made no download progress and was stopped; the launch-only
diagnostic again returned `BROWSER_LAUNCH_FAILED` before network navigation.
Playwright resolved the expected regular-Chromium path, but its required macOS
framework remained absent. This is an installation/harness failure, not an
`ACCESS_CHALLENGE` or other Car-Part result.

The headless-shell execution used the installed Playwright headless-shell binary
explicitly because the current Playwright package's expected cached browser was
incomplete. It loaded the homepage and parsed options, submitted the ordinary
form, then received the known challenge. No retry or configuration change was
made.

### Linux headed Chrome with Xvfb

`Dockerfile.browser-matrix` is a deliberately small, non-production Linux
harness: Deno `2.9.6`, Google Chrome stable, Xvfb, and `xauth` (required by the
Debian `xvfb-run` helper). `.dockerignore` excludes `.env`. The local host is
Apple Silicon, so the image is explicitly `linux/amd64` for Google's x86_64-only
Chrome package and runs through Docker Desktop emulation.

```sh
docker build --platform linux/amd64 -f Dockerfile.browser-matrix -t car-part-browser-matrix .
docker run --rm --platform linux/amd64 car-part-browser-matrix
```

Under x86_64 emulation, Debian's `xvfb-run` did not receive Xvfb's expected
readiness signal even though Xvfb was running. `scripts/with-xvfb.sh` is the
equivalent minimal launcher used by the image: it starts `Xvfb :99` with a
`1280x900x24` screen, verifies that process, exports `DISPLAY=:99`, and cleans
it up. It launches normal `channel: "chrome"`, `headless: false` Chrome—no
`--headless` flag or identity modification.

Infrastructure validation passed without contacting Car-Part: Debian GNU/Linux
13.6 (`x86_64`), Docker Desktop `29.7.2`, Deno `2.9.6`, Playwright `1.58.2`,
Xvfb `2:21.1.16-1.3+deb13u4`, Chrome `153.0.8010.36`, and `DISPLAY=:99`.
Playwright launched headed Chrome, reported its version, and navigated to
`about:blank`; it closed normally.

The one permitted live run then completed all stages, returned 50 listings and
`hasNextPage: true`, with no challenge. Timings were 1.5 s session creation, 681
ms homepage load, 683 ms initial submit, 407 ms refinement submit, 72 ms result
parse, and 5.8 s total. It used Docker Desktop's ordinary local NAT; the
container is not a remote host, though its public egress IP was not separately
measured.

### Control interpretation

The original Google Chrome headless control used `channel: "chrome"` and
`headless: true`. The installed branded Chrome is `153.0.8010.37`; Chrome's
current documentation states that `--headless` on Chrome 132+ runs unified/new
headless in the full Chrome binary, while the legacy implementation is the
separate `chrome-headless-shell` executable. Thus the control is accurately
described as **Google Chrome unified/new headless**, not headless shell. This is
consistent with Playwright's separate `channel: "chromium"` opt-in for its
regular managed Chromium new-headless distribution.

### Explicit answers

1. **Does Chromium new-headless complete the search?** Not established: its
   local managed browser bundle failed before launch.
2. **Does Chromium headless shell complete the search?** No. It received
   `ACCESS_CHALLENGE` after initial form submission.
3. **Does normal headed Chrome work under Xvfb?** Yes. It completed the
   representative search with 50 listings and a next page.
4. **Is a physical desktop required?** No. Xvfb supplied the only display.
5. **Which successful mode has the lowest practical resource cost?** Xvfb adds a
   small display-server process but does not make Chrome lightweight; resource
   optimization was not the purpose of this successful compatibility result.
6. **Does Browserless remain necessary?** No. It is optional hosting, not a
   requirement.
7. **What browser-host architecture should be used next?**
   `Deno Deploy →
   authenticated CDP or internal RPC → Linux worker (Xvfb + Google Chrome,
   headless:false) → Car-Part`.

### Final conclusion

Chrome 153 unified/new headless and the lightweight headless shell were both
challenged, while normal headed Chrome under Xvfb succeeded. A physical desktop
is not required; normal headed Chrome behavior with a graphical display server
is sufficient in this local Linux test. A self-hosted Linux browser worker is
therefore viable and Browserless is optional. No further compatibility modes
were tested.
