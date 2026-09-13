import { loadCarPartCatalog } from "../browser/car_part_browser.ts";
import { BrowserlessBrowserProvider } from "../browser/browserless_browser_provider.ts";
import { getCatalog, saveCatalog } from "../repositories/catalog_repository.ts";
import type { SearchOptions } from "../types.ts";

function valid(catalog: SearchOptions) {
  return Object.values(catalog).every((items) => items.length > 0);
}
async function checksum(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((
    byte,
  ) => byte.toString(16).padStart(2, "0")).join("");
}
export async function refreshCatalog() {
  const payload = await loadCarPartCatalog(new BrowserlessBrowserProvider());
  if (!valid(payload)) {
    throw new Error("Catalog refresh returned an incomplete selector catalog");
  }
  return await saveCatalog(payload, await checksum(payload));
}
export { getCatalog };
