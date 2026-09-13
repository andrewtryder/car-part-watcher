import { discoverCarPartRefinement } from "../browser/car_part_browser.ts";
import { BrowserlessBrowserProvider } from "../browser/browserless_browser_provider.ts";
import { getCatalog } from "../repositories/catalog_repository.ts";
import {
  deleteWatch,
  getWatch,
  listWatches,
  saveWatch,
  type Watch,
} from "../repositories/watch_repository.ts";
import type { CarPartSearchRequest, SelectOption } from "../types.ts";
import { executeWatch } from "./reconciliation_service.ts";
import { listSearchRuns } from "../repositories/search_run_repository.ts";

const present = (items: SelectOption[], value: string) =>
  items.some((item) => item.label === value || item.value === value);
export async function validateWatch(
  input: Omit<Watch, "id" | "createdAt" | "updatedAt">,
) {
  const catalog = await getCatalog();
  if (!catalog) throw new Error("Catalog is not initialized");
  const request = input as CarPartSearchRequest;
  if (
    !input.name.trim() || !present(catalog.payload.years, request.year) ||
    !present(catalog.payload.makeModels, request.makeModel) ||
    !present(catalog.payload.parts, request.part) ||
    !present(catalog.payload.sorts, request.sort) ||
    (request.location && !present(catalog.payload.locations, request.location))
  ) throw new Error("Watch criteria are not present in the cached catalog");
  if (request.sort === "zip" && !request.postalCode?.trim()) {
    throw new Error("Postal code is required when sorting by distance");
  }
}
export async function resolveWatch(request: CarPartSearchRequest) {
  return await discoverCarPartRefinement(
    new BrowserlessBrowserProvider(),
    request,
  );
}
export { deleteWatch, executeWatch, getWatch, listSearchRuns, listWatches, saveWatch };
