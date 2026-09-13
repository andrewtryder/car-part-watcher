# Car-Part.com Search Interface Discovery

## Scope and observation

This is a discovery record of the public, normal browser flow observed on 2026-09-12. It is not an API specification and does not propose circumventing the site's controls. The representative browser search was **2015 Honda Accord / Alternator / New York / sort by price**.

The initial form, the fitment/interchange choice, and the inventory page are all server-rendered HTML pages. No XHR/fetch was made for the vehicle, part, or result data in this flow.

## Search flow

1. Load `https://www.car-part.com/`. The initial page contains all year, combined make/model, and part options in its HTML, plus six per-page hidden `tk*` fields.
2. Choose the visible values: `2015`, `Honda Accord`, `Alternator`, `New York`, and `Price`. A ZIP is needed only when the selected sort is distance (`zip`).
3. The browser POSTs the form to `/cgi-bin/search.cgi` as `application/x-www-form-urlencoded`.
4. The response is an **interchange/refinement** HTML page. For this example it offered four radio choices: `2.4L (Mitsubishi manufacturer), AT (CVT)`; `3.5L (Denso manufacturer), AT`; `2.4L (Mitsubishi manufacturer), MT`; and `3.5L (Denso manufacturer), MT`.
5. Select one radio choice and submit the second HTML form. The chosen opaque interchange string, plus fields the server generated on the refinement page, are POSTed to the same endpoint.
6. The response is the inventory-results HTML page. Page links and sortable headings issue full GET navigations to `/cgi-bin/search.cgi`, repeating server-generated state in the query string.

The initial UI does not use a separate Make field: `userModel` is a single combined **Make/Model** select. The displayed text is also its submitted value.

## Search fields

| Visible label / control | HTML | Name / ID | Example submitted value | Required / default | Loading and dependency |
| --- | --- | --- | --- | --- |
| Year | `select` | `userDate` / `year` | `2015` | Required for the observed non-VIN flow; default displayed/value `Select Year` | 128 options are embedded HTML; no dependency. |
| Make/Model | `select` | `userModel` / `model` | `Honda Accord` | Required; default `Select Make/Model` | 1,670 combined values embedded HTML. No separate make ID or dependent make request. |
| Part | `select` | `userPart` / `part` | `Alternator` | Required; default `Select Part` | 803 values embedded HTML; no dependency. |
| Area | `select` | `userLocation` / `Loc` | `New York` | Optional; default text `All Areas/Select an Area`, value `All States` | Embedded HTML, with countries, regions, city regions, and states/provinces. |
| Sort | `select` | `userPreference` / no ID | `price` | Defaults to `zip` (shown as “Sort by Distance/Select Sort”) | Embedded values: `zip`, `grade`, `condition`, `price`, `year`. |
| Postal code | text input | `userZip` / no ID | empty in observed price search | Required by client-side validation only if sort is `zip`; max length 10 | Not dynamically loaded. |
| Save | checkbox | `svZip` / no ID | `y` when checked | Checked by default; preference persistence only | Not a search semantic. |
| Search button | image input | `Search Car Part Inventory` | Browser may add `.x`/`.y` coordinates | Initiates submit | Not material to observed first POST when submitted programmatically through the form. |

Additional initial, non-visible fields are `userPage=1`, `userInterchange=None`, `userDate2=Ending Year`, and `userSearch=int`. `userVIN` is a text input present in the DOM but initially hidden. The page can switch between the year/model and SmartVin modes using a `vinLookup` cookie; VIN behavior was not exercised.

### Display text versus machine value

- Year values equal their visible years (for example, `2015`).
- Make/model and part values equal their visible strings (for example, `Honda Accord` and `Alternator`).
- Region labels may differ from values: “All Areas/Select an Area” submits `All States`; “East Central” submits `eastcentral`; “Western Canada” submits `wcanada`.
- Sort labels map to short values listed above.
- The server subsequently resolves the human-readable make/model and part into internal `dbModel` and `dbPart` values. In this run: `Honda Accord` -> `dbModel=30.3.1.1`; `Alternator` -> `dbPart=601.1`.

## Dependent option loading

There is no observed year -> make -> model -> part cascade on the desktop initial page. The initial response already contains every valid Year, combined Make/Model, and Part `<option>`. The only observed JavaScript around the initial form persists form preferences to cookies and switches the alternate VIN UI; it does not request dropdown data.

Therefore, a future browser-compatible client can obtain current valid human-readable choices by loading and parsing the initial HTML. It should not hard-code the lists. The internal model and part IDs are not available at that stage; they appear in the server's refinement/result forms after it has accepted the labels.

## Network requests

### Initial inventory/search request

`POST https://www.car-part.com/cgi-bin/search.cgi`

- Content type: `application/x-www-form-urlencoded`
- Browser headers observed: `Origin: https://www.car-part.com` and `Referer: https://www.car-part.com/`.
- Response: `200 text/html`, the interchange/refinement page in this example.
- No redirect was observed.

Sanitized example body (the `tk*` values are deliberately redacted):

```text
tk1=<dynamic>&tk2=<dynamic>&tk3=<dynamic>&tk4=<dynamic>&tk5=<dynamic>&tk6=<dynamic>
&userDate=2015&userVIN=&userModel=Honda+Accord&userPart=Alternator
&userLocation=New+York&userPreference=price&userZip=&svZip=y&userPage=1
&userInterchange=None&userDate2=Ending+Year&userSearch=int
```

| Parameter class | Parameters / meaning |
| --- | --- |
| User-controlled | `userDate`, `userModel`, `userPart`, `userLocation`, `userPreference`, `userZip`, `svZip` |
| Fixed/form-flow | `userPage=1`, `userInterchange=None`, `userDate2=Ending Year`, `userSearch=int` |
| Dynamic/session-bound | `tk1` through `tk6`; generated in initial HTML. `tk4` also corresponded to the initial response's `tk4` cookie. Treat all six as required and short-lived unless later testing proves otherwise. |

### Refinement submission

`POST https://www.car-part.com/cgi-bin/search.cgi`, also form-url-encoded, returns `200 text/html` inventory results.

The observed first interchange option submitted:

```text
sessionID=18000000139444294&userModel=Honda+Accord&userPart=Alternator
&dbPart=601.1&userLocation=New+York&userPreference=price&userPage=1
&userInterchange=C%3E%3D%40A%7D%7D%7D601%7D72958%7DHO
&userSearch=int&dbModel=30.3.1.1&dummyVar=C%3E%3D%40A%7D%7D%7D601%7D72958%7DHO
&userDate=2015&userDate2=2015&tk1=<dynamic>...&tk6=<dynamic>
```

The page also carried empty but submitted fields including `ref`, `iKey`, `uID`, `uPass`, `dbSubPart`, `confirm_yes`, `confirm_no`, `iCN`, `userClaim`, `userLang`, `userLat`, `userLong`, `userAdjuster`, `limitYears`, `userVIN`, `userVINModelID`, `userIMS`, `imsFullSpecification`, and `vinSearch`. They are server-provided state, not user inputs. The clicked image also caused the usual `Search Car Part Inventory.x=0` and `.y=0` fields.

## Refinement flow

The first response has a `MainForm` with `sessionID`, the original labels, `dbPart`, `dbModel`, `userInterchange`, and radio buttons named `dummyVar`. Selecting a radio calls the page's `setInterchange()` JavaScript, which copies the selected opaque value into hidden `userInterchange`.

For the observed vehicle/part, the opaque value includes the part/model interchange information; it must be treated as opaque, not reconstructed. It was `C>=@A}}}601}72958}HO` for the selected 2.4L/CVT option (URL-encoded in requests). The results page exposes `userIntSelect=72958`, the numeric interchange selection embedded in that value.

Preserve all refinement-form hidden fields, especially `sessionID`, `dbModel`, `dbPart`, `userInterchange`, labels, sort/location/ZIP, and `tk1`–`tk6`. Whether a part produces a refinement page is vehicle/part dependent. This example did; a future implementation must parse the first response and branch rather than assume direct results.

## Browser/session requirements

| State | Classification | Observation |
| --- | --- | --- |
| `tk1`–`tk6` hidden inputs | Required/likely anti-automation integrity state | Present on initial, refinement, result, sorting, and pagination flows; regenerated with the initial page. Do not synthesize them. |
| `tk4` cookie | Required/unknown | Set by initial response and duplicated in hidden `tk4`; treat browser cookie continuity as required. |
| Cloudflare cookies/challenge state | Required | A non-browser replay received a Cloudflare challenge while the normal Chrome flow succeeded. A compatible implementation must use a normal browser session and respect the site's protections; no bypass was attempted. |
| `sessionID` | Required after refinement | Generated on the refinement response and repeated in results/sort/page URLs. |
| Preference cookies (`vinLookup`, `year`, `model`, `userZip`, `userSort`, `Loc`, `svZip`) | Incidental to one execution | Client JavaScript writes them to restore UI preferences. They were not used as the sole source of the submitted search state. |
| `localStorage` / `sessionStorage` | Incidental/none observed | Both were empty. |
| Analytics cookies | Incidental | Google Analytics cookies were present; not part of the site search form. |

## Results structure

The final response is server-rendered HTML. The primary table had 52 rows in the observed run: a heading row, 50 listings, and a repeated heading row. Listing cells are rendered directly in the DOM; images are subsequent GETs to `wsimgoh.car-part.com` and are not the listing-data response.

| Normalized field | HTML/request source | Example | Notes |
| --- | --- | --- | --- |
| Vehicle | first cell text | `2017 Alternator Honda Accord` | Year, part, and model are line-separated in the first `<td>`. |
| Description/options | second cell text | `2.40L` | May be blank; the same cell may contain thumbnail link/image. |
| Grade | third cell | `A` | Page describes A/B/C/X grading. |
| Stock number | fourth cell | `MKG240` | Visible recycler stock number. |
| Price | fifth cell | `$107` | Local currency; may be blank/unpriced. |
| Recycler/name and location | sixth cell | `Jerry Browns Auto Parts Ltd. / Fenix Parts Inc. USA-NY(Queensbury)` | Recycler name is usually an external link. |
| Phone/contact actions | sixth cell | `518-798-8141`, `Request_Quote` | Quote URL includes record attributes and `selleruserid`. |
| Image/detail identity | image link query | `partGUID=1097-ma29-10242027`, `vehicleGUID=1097-ma29-VMKG240` | Present only where image exists. |
| Recycler/source ID | image/quote URL | `partsourceid=1097`, `selleruserid=1213` | Useful supplemental identity. |

## Result identity

No single first-class listing ID is shown in every result row. The strongest candidates observed are:

1. An image-linked `partGUID` plus `partsourceid` when an image is available.
2. Quote-link `selleruserid` plus `stockNum` (and preferably the part/model/year/interchange), which is available on quote-capable results.
3. Visible stock number plus recycler identity, a fallback only; stock number alone cannot be assumed globally unique.

The image URL also included a `vehicleGUID`. The run did not test the same record across compatible searches or after price/description changes, so stability of any candidate is **unknown**. Do not invent a universal identity from stock number alone.

## Pagination

The observed result table displayed 50 listings per numbered page and offered pages `1`, `2`, `3`, and `*4` (`*` marks a page with the lowest/not-priced part according to the UI).

Page 2 is a full `GET` to `/cgi-bin/search.cgi`, returning `200 text/html`. It repeats the complete derived state and changes `userPage=1` to `userPage=2`; there is no offset or cursor. Representative required-looking query state includes `userSearch=int`, `userPID=1000`, `userLocation`, `userInterchange`, `userDate`, `userDate2`, `dbModel`, `userModel`, `dbPart`, `userPart`, `sessionID`, `sURL`, `userPreference`, `userIntSelect`, `userInterchangeSource`, `tk1`–`tk6`, `userUID`, `userBroker`, `iKey`, and `userPage`.

## Sorting and filters

The initial sort select contributes `userPreference`. On results, clickable heading links make full GET navigations, reset `userPage=1`, and set `userPreference` to the selected heading's value. Observed `Year` used `userPreference=year`; the UI showed headings for `Year`, `Part Grade`, and `US Price` (the page was currently price-sorted). No client-side sorting or asynchronous filter request was observed.

The results page also supplies two full-GET links: “All Interchange Choices” (`userSearch=int`) and “Non-Interchange Choices” (`userSearch=exact&exactSearch=1`), both carrying the derived model/part/interchange/token state. They are search-scope toggles, not in-page filters.

## Minimal search model

The smallest logical persisted request should be:

```text
{ year, makeModel, part, location?, sort?, postalCode? }
```

`postalCode` is mandatory when `sort === "zip"`; `location` is optional; `sort` defaults to `zip` in the UI but requires a postal code, so a future product should explicitly choose both. Store human-readable `makeModel` and `part`, then load the current initial form at execution time and confirm they remain valid. Do **not** persist `dbModel`, `dbPart`, interchange strings, `sessionID`, or `tk*` values: they are server-generated, request/session-specific derived state. A persisted refinement preference could be a human-readable rule (for example, engine/transmission), but it must be matched against the current refinement choices at execution time.

## Suggested implementation flow

```text
open normal browser session at homepage
parse initial form and its current hidden tk* fields
resolve stored year/makeModel/part/location/sort against current option values
validate postal code when sort is zip
submit the initial form through the normal browser
parse HTML response
if it is an interchange/refinement form:
    parse opaque choices and all hidden fields
    select configured/human-approved choice
    submit the supplied refinement form unchanged except that choice
parse server-rendered result rows and quote/image links
while a desired page link exists:
    follow its supplied GET URL in the same browser session
    parse server-rendered rows
```

## Unknowns

- Whether all vehicle/part combinations always refine, and the complete taxonomy of possible refinement questions.
- Precise server-side enforcement/lifetime of `tk*`, `sessionID`, and cookie state. They were treated as opaque and preserved, not manipulated.
- Whether an image `partGUID` is stable across inventory updates and available for every listing.
- The exact behavior of VIN/SmartVin mode, distance calculations, and every sort heading/value were not separately exercised.
- A direct non-browser request was blocked by Cloudflare; this record does not claim a standalone HTTP client can reproduce the flow.

## Final summary

- **Exact sequence:** initial form POST -> parse an optional server-rendered refinement form -> submit selected opaque interchange -> parse HTML results -> follow supplied GET links for pages/sorts.
- **Valid choices:** Year, combined Make/Model, and Part options are embedded in the initial HTML; no dependent option request was observed.
- **Search request:** `POST /cgi-bin/search.cgi`, form-url-encoded, including labels, preferences, fixed flow fields, and current `tk1`–`tk6`.
- **Session state:** yes in practice—browser/Cloudflare cookie state, current hidden `tk*` values, and post-refinement `sessionID` must be preserved. Do not attempt to manufacture them.
- **Intermediate refinement:** yes for the observed Honda alternator; it contributes the opaque `userInterchange` value and generated `dbModel`/`dbPart`/`sessionID` state.
- **Result format:** server-rendered HTML table, plus optional thumbnail image requests.
- **Additional pages:** full GETs with `userPage=N` and repeated derived state; 50 rows per observed page.
- **Stable listing ID:** none universal was exposed. Candidate composite identity is `selleruserid + stockNum`, augmented by `partGUID`/`partsourceid` where available.
- **Minimum persisted input:** human-readable `{year, makeModel, part, location?, sort?, postalCode?}`; resolve live option values and derived IDs at execution time.

- **Simplest strategy:** drive the same browser forms in one normal, stateful browser session, parse each supplied HTML form/link, and preserve all server-generated fields verbatim.
