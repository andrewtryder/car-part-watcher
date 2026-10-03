import { getCatalog, saveCatalog } from "../repositories/catalog_repository.ts";
import type { SearchOptions } from "../types.ts";
import type { CarPartSearchClient } from "../search/car_part_search_client.ts";

function valid(catalog: SearchOptions) {
  return Object.values(catalog).every((items) => items.length > 0);
}
async function checksum(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((
    byte,
  ) => byte.toString(16).padStart(2, "0")).join("");
}
export async function loadValidatedCatalog(
  searchClient: CarPartSearchClient,
): Promise<SearchOptions> {
  const payload = await searchClient.loadCatalog();
  if (!valid(payload)) {
    throw new Error("Catalog refresh returned an incomplete selector catalog");
  }
  return payload;
}
export async function refreshCatalog(searchClient: CarPartSearchClient) {
  const payload = await loadValidatedCatalog(searchClient);
  return await saveCatalog(payload, await checksum(payload));
}
export { getCatalog };
