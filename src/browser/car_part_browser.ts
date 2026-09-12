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
  SpikeResult,
} from "../types.ts";
import { SpikeError } from "../types.ts";

export interface BrowserSession {
  context: BrowserContext;
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
  const session = await provider.createSession();
  try {
    const page = await session.context.newPage();
    try {
      await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
    } catch (cause) {
      throw new SpikeError(
        "PAGE_LOAD_FAILED",
        "Could not load the Car-Part homepage",
        { cause: String(cause) },
      );
    }
    onStage("homepage load");
    const options = await getSearchOptions(page);
    onStage("search options extracted");
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
      await submit(page, "input[name='Search Car Part Inventory']");
    } catch (cause) {
      throw new SpikeError(
        "FORM_SUBMIT_FAILED",
        "Could not submit the initial search form",
        { cause: String(cause) },
      );
    }
    onStage("initial form submitted");
    let type = await detectPageType(page);
    let refinement: SpikeResult["refinement"];
    if (type === "refinement") {
      onStage("refinement page reached");
      const available = parseRefinementChoices(await page.content());
      if (!available.length) {
        throw new SpikeError(
          "REFINEMENT_PARSE_FAILED",
          "Refinement page did not expose any visible choices",
        );
      }
      onStage("refinement choices extracted");
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
        await submit(page, "#MainForm input[name='Search Car Part Inventory']");
      } catch (cause) {
        throw new SpikeError(
          "FORM_SUBMIT_FAILED",
          "Could not submit the refinement form",
          { cause: String(cause) },
        );
      }
      onStage("refinement submitted");
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
    onStage("results page reached");
    const html = await page.content();
    const listings = parseResults(html);
    if (!listings.length) {
      throw new SpikeError(
        "RESULTS_PARSE_FAILED",
        "Results page had no parseable listing rows",
      );
    }
    onStage("results parsed");
    if (listings.length === 50) onStage("50 listings parsed");
    const hasNextPage = hasNextResultsPage(html);
    if (hasNextPage) onStage("next-page detected");
    return {
      search: request,
      refinement,
      results: {
        count: listings.length,
        hasNextPage,
        listings,
      },
    };
  } finally {
    await session.close();
  }
}
