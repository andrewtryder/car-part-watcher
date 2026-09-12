import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from "npm:playwright@1.58.2";
import { parseRefinementChoices } from "../parsers/refinement.ts";
import { hasNextResultsPage, parseResults } from "../parsers/results.ts";
import { parseSearchOptions } from "../parsers/search_options.ts";
import type {
  CarPartSearchRequest,
  SearchOptions,
  SearchTimings,
  SpikeResult,
} from "../types.ts";
import { SpikeError } from "../types.ts";

export interface BrowserSession {
  context: BrowserContext;
  page?: Page;
  timings?: Pick<SearchTimings, "sessionCreateMs" | "cdpConnectMs">;
  close(): Promise<void>;
}
export interface BrowserProvider {
  createSession(): Promise<BrowserSession>;
}

export class ChromeBrowserProvider implements BrowserProvider {
  constructor(
    private readonly headless = Deno.env.get("PLAYWRIGHT_HEADLESS") === "true",
  ) {}

  async createSession(): Promise<BrowserSession> {
    let browser: Browser;
    try {
      browser = await chromium.launch({
        headless: this.headless,
        channel: "chrome",
      });
    } catch (cause) {
      throw new SpikeError(
        "BROWSER_LAUNCH_FAILED",
        "Playwright could not launch Chromium",
        { cause: String(cause) },
      );
    }
    const context = await browser.newContext();
    return { context, close: () => browser.close() };
  }
}

/** @deprecated Use ChromeBrowserProvider. Kept while the temporary endpoint uses this name. */
export const LocalBrowserProvider = ChromeBrowserProvider;

const homeUrl = "https://www.car-part.com/";
const representativeSearch: CarPartSearchRequest = {
  year: "2015",
  makeModel: "Honda Accord",
  part: "Alternator",
  location: "New York",
  sort: "price",
  refinement: { label: "2.4L (Mitsubishi manufacturer), AT (CVT)" },
};

function assertNoChallenge(html: string) {
  if (/just a moment|cf-chl|challenges\.cloudflare\.com/i.test(html)) {
    throw new SpikeError(
      "ACCESS_CHALLENGE",
      "The site presented an access challenge; the spike stopped without attempting to bypass it.",
    );
  }
}

export async function getSearchOptions(page: Page): Promise<SearchOptions> {
  const html = await page.content();
  assertNoChallenge(html);
  return parseSearchOptions(html);
}

export async function detectPageType(
  page: Page,
): Promise<"refinement" | "results" | "unknown"> {
  const html = await page.content();
  assertNoChallenge(html);
  if (
    await page.locator("#MainForm input[type='radio'][name='dummyVar']").count()
  ) return "refinement";
  if (
    await page.locator("table").evaluateAll((tables) =>
      tables.some((table) => table.textContent?.includes("Stock#"))
    )
  ) return "results";
  return "unknown";
}

function optionValue(
  options: SearchOptions,
  key: keyof SearchOptions,
  label: string,
) {
  const option = options[key].find((candidate) =>
    candidate.label === label || candidate.value === label
  );
  if (!option) {
    throw new SpikeError(
      "SEARCH_OPTION_NOT_FOUND",
      `No current ${key} option matches ${JSON.stringify(label)}`,
      { available: options[key].slice(0, 25).map((item) => item.label) },
    );
  }
  return option.value;
}

async function submit(page: Page, selector: string) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.locator(selector).click(),
  ]);
}

export async function runCarPartSearch(
  provider: BrowserProvider,
  request = representativeSearch,
  onStage: (stage: string) => void = () => {},
): Promise<SpikeResult> {
  const startedAt = performance.now();
  let stage = "session_create";
  let session: BrowserSession | undefined;
  const timings: SearchTimings = {};
  const recordStage = (nextStage: string) => {
    stage = nextStage;
    onStage(nextStage);
  };
  try {
    session = await provider.createSession();
    Object.assign(timings, session.timings);
    const page = session.page ?? await session.context.newPage();
    stage = "homepage_load";
    try {
      const beganAt = performance.now();
      await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
      timings.homepageLoadMs = Math.round(performance.now() - beganAt);
    } catch (cause) {
      throw new SpikeError(
        "PAGE_LOAD_FAILED",
        "Could not load the Car-Part homepage",
        { cause: String(cause) },
      );
    }
    recordStage("homepage load");
    const options = await getSearchOptions(page);
    recordStage("search options extracted");
    await page.selectOption(
      "select[name='userDate']",
      optionValue(options, "years", request.year),
    );
    await page.selectOption(
      "select[name='userModel']",
      optionValue(options, "makeModels", request.makeModel),
    );
    await page.selectOption(
      "select[name='userPart']",
      optionValue(options, "parts", request.part),
    );
    if (request.location) {
      await page.selectOption(
        "select[name='userLocation']",
        optionValue(options, "locations", request.location),
      );
    }
    await page.selectOption(
      "select[name='userPreference']",
      optionValue(options, "sorts", request.sort),
    );
    if (request.postalCode) {
      await page.locator("input[name='userZip']").fill(request.postalCode);
    }
    try {
      stage = "initial_form_submit";
      const beganAt = performance.now();
      await submit(page, "input[name='Search Car Part Inventory']");
      timings.initialSubmitMs = Math.round(performance.now() - beganAt);
    } catch (cause) {
      throw new SpikeError(
        "FORM_SUBMIT_FAILED",
        "Could not submit the initial search form",
        { cause: String(cause) },
      );
    }
    recordStage("initial form submitted");
    let type = await detectPageType(page);
    let refinement: SpikeResult["refinement"];
    if (type === "refinement") {
      recordStage("refinement page reached");
      const available = parseRefinementChoices(await page.content());
      if (!available.length) {
        throw new SpikeError(
          "REFINEMENT_PARSE_FAILED",
          "Refinement page did not expose any visible choices",
        );
      }
      recordStage("refinement choices extracted");
      if (!request.refinement) {
        throw new SpikeError(
          "REFINEMENT_REQUIRED",
          "The search requires a refinement choice",
          { available },
        );
      }
      const index = available.indexOf(request.refinement.label);
      if (index < 0) {
        throw new SpikeError(
          "REFINEMENT_OPTION_NOT_FOUND",
          "The requested refinement is not currently available",
          { requested: request.refinement.label, available },
        );
      }
      await page.locator("#MainForm input[type='radio'][name='dummyVar']").nth(
        index,
      ).check();
      try {
        stage = "refinement_submit";
        const beganAt = performance.now();
        await submit(page, "#MainForm input[name='Search Car Part Inventory']");
        timings.refinementSubmitMs = Math.round(performance.now() - beganAt);
      } catch (cause) {
        throw new SpikeError(
          "FORM_SUBMIT_FAILED",
          "Could not submit the refinement form",
          { cause: String(cause) },
        );
      }
      recordStage("refinement submitted");
      refinement = { selected: request.refinement.label, available };
      type = await detectPageType(page);
    }
    if (type !== "results") {
      throw new SpikeError(
        "UNEXPECTED_PAGE",
        "Expected a refinement or results page",
        { title: await page.title() },
      );
    }
    recordStage("results page reached");
    const parseBeganAt = performance.now();
    const html = await page.content();
    const listings = parseResults(html);
    if (!listings.length) {
      throw new SpikeError(
        "RESULTS_PARSE_FAILED",
        "Results page had no parseable listing rows",
      );
    }
    timings.resultParseMs = Math.round(performance.now() - parseBeganAt);
    recordStage("results parsed");
    if (listings.length === 50) recordStage("50 listings parsed");
    const hasNextPage = hasNextResultsPage(html);
    if (hasNextPage) recordStage("next-page detected");
    timings.totalMs = Math.round(performance.now() - startedAt);
    return {
      search: request,
      refinement,
      results: {
        count: listings.length,
        hasNextPage,
        listings,
      },
      timings,
    };
  } catch (error) {
    if (error instanceof SpikeError) {
      const details = error.details && typeof error.details === "object"
        ? error.details
        : {};
      throw new SpikeError(error.code, error.message, {
        stage,
        ...details,
      });
    }
    throw error;
  } finally {
    if (session) {
      await session.close();
      onStage("browser session closed");
    }
  }
}
