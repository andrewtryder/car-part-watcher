import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.19";
import type { BrowserProvider } from "../src/browser/car_part_browser.ts";
import {
  BrowserlessCarPartSearchClient,
  type CarPartSearchClient,
} from "../src/search/car_part_search_client.ts";
import { loadValidatedCatalog } from "../src/services/catalog_service.ts";
import { resolveWatch } from "../src/services/watch_service.ts";
import type { CarPartSearchRequest, SearchOptions } from "../src/types.ts";

const request: CarPartSearchRequest = {
  year: "2015",
  makeModel: "Honda Accord",
  part: "Alternator",
  sort: "price",
};

const catalog: SearchOptions = {
  years: [{ label: "2015", value: "2015" }],
  makeModels: [{ label: "Honda Accord", value: "accord" }],
  parts: [{ label: "Alternator", value: "alternator" }],
  locations: [{ label: "USA", value: "usa" }],
  sorts: [{ label: "Price", value: "price" }],
};

Deno.test("watch refinement delegates to the supplied search client", async () => {
  let received: CarPartSearchRequest | undefined;
  const client: CarPartSearchClient = {
    search: () => Promise.reject(new Error("not used")),
    resolveRefinement: (value) => {
      received = value;
      return Promise.resolve({ status: "ready" });
    },
    loadCatalog: () => Promise.resolve(catalog),
  };

  assertEquals(await resolveWatch(client, request), { status: "ready" });
  assertEquals(received, request);
});

Deno.test("catalog loading delegates to the supplied search client", async () => {
  let calls = 0;
  const client: CarPartSearchClient = {
    search: () => Promise.reject(new Error("not used")),
    resolveRefinement: () => Promise.resolve({ status: "ready" }),
    loadCatalog: () => {
      calls++;
      return Promise.resolve(catalog);
    },
  };

  assertEquals(await loadValidatedCatalog(client), catalog);
  assertEquals(calls, 1);
});

Deno.test("Browserless search client delegates each operation to its provider", async () => {
  const provider: BrowserProvider = {
    createSession: () => Promise.reject(new Error("provider invoked")),
  };
  const client = new BrowserlessCarPartSearchClient(provider);

  await assertRejects(() => client.search(request), Error, "provider invoked");
  await assertRejects(
    () => client.resolveRefinement(request),
    Error,
    "provider invoked",
  );
  await assertRejects(() => client.loadCatalog(), Error, "provider invoked");
});
