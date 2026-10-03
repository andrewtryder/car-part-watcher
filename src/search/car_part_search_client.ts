import {
  type BrowserProvider,
  discoverCarPartRefinement,
  loadCarPartCatalog,
  runCarPartSearch,
} from "../browser/car_part_browser.ts";
import { BrowserlessBrowserProvider } from "../browser/browserless_browser_provider.ts";
import type {
  CarPartSearchRequest,
  CarPartSearchResult,
  SearchExecutionOptions,
  SearchOptions,
} from "../types.ts";

export type CarPartRefinementResult =
  | { status: "refinement_required"; choices: { label: string }[] }
  | { status: "ready" };

export interface CarPartSearchClient {
  search(
    request: CarPartSearchRequest,
    options?: SearchExecutionOptions,
  ): Promise<CarPartSearchResult>;
  resolveRefinement(
    request: CarPartSearchRequest,
  ): Promise<CarPartRefinementResult>;
  loadCatalog(): Promise<SearchOptions>;
}

/** Production adapter that keeps Browserless behind the search-client boundary. */
export class BrowserlessCarPartSearchClient implements CarPartSearchClient {
  constructor(
    private readonly provider: BrowserProvider =
      new BrowserlessBrowserProvider(),
  ) {}

  search(
    request: CarPartSearchRequest,
    options?: SearchExecutionOptions,
  ): Promise<CarPartSearchResult> {
    return runCarPartSearch(this.provider, request, () => {}, options);
  }

  resolveRefinement(
    request: CarPartSearchRequest,
  ): Promise<CarPartRefinementResult> {
    return discoverCarPartRefinement(this.provider, request);
  }

  loadCatalog(): Promise<SearchOptions> {
    return loadCarPartCatalog(this.provider);
  }
}
