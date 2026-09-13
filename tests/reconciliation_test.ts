import { assertEquals, assertExists } from "jsr:@std/assert@1.0.19";
import { sourceKey } from "../src/identity.ts";
import type { PartsSource } from "../src/parts_source.ts";
import type {
  CarPartListing,
  CarPartSearchRequest,
  SpikeResult,
} from "../src/types.ts";
import { WatchStore } from "../src/watch_store.ts";

const request: CarPartSearchRequest = {
  year: "2015",
  makeModel: "Honda Accord",
  part: "Alternator",
  location: "New York",
  sort: "price",
};
const listing: CarPartListing = {
  year: "2015",
  makeModel: "Honda Accord",
  part: "Alternator",
  sellerUserId: "1213",
  stockNumber: "ABC123",
  recycler: { name: "Example Recycler" },
  price: { amount: 107, currency: "USD", display: "$107" },
};

function result(listings: CarPartListing[]): SpikeResult {
  return {
    search: request,
    results: { count: listings.length, hasNextPage: false, listings },
  };
}
class FakeSource implements PartsSource {
  constructor(private readonly next: () => Promise<SpikeResult>) {}
  search(_request: CarPartSearchRequest) {
    return this.next();
  }
}
async function freshStore() {
  const kv = await Deno.openKv(":memory:");
  return { kv, store: new WatchStore(kv) };
}

Deno.test("first successful result creates a listing and watch association", async () => {
  const { kv, store } = await freshStore();
  try {
    const watch = await store.createWatch(request);
    const summary = await store.runWatch(
      watch,
      new FakeSource(() => Promise.resolve(result([listing]))),
    );
    assertEquals(summary.newForWatch, 1);
    assertEquals(summary.newListings.length, 1);
    assertEquals(summary.updatedListings, 0);
    const stored = await store.getListing((await sourceKey(listing))!);
    assertExists(stored);
    assertEquals(stored.listing.price?.amount, 107);
    assertExists(await store.getWatchListing(watch.id, stored.id));
  } finally {
    await kv.close();
  }
});

Deno.test("repeat result is not new and updates mutable listing fields", async () => {
  const { kv, store } = await freshStore();
  try {
    const watch = await store.createWatch(request);
    await store.runWatch(
      watch,
      new FakeSource(() => Promise.resolve(result([listing]))),
    );
    const revised = {
      ...listing,
      price: { amount: 125, currency: "USD", display: "$125" },
      grade: "A",
      description: "Repriced alternator",
    };
    const summary = await store.runWatch(
      watch,
      new FakeSource(() => Promise.resolve(result([revised]))),
    );
    assertEquals(summary.newForWatch, 0);
    assertEquals(summary.updatedListings, 1);
    const stored = await store.getListing((await sourceKey(listing))!);
    assertEquals(stored?.listing.price?.amount, 125);
    assertEquals(stored?.listing.grade, "A");
    assertEquals(stored?.listing.description, "Repriced alternator");
  } finally {
    await kv.close();
  }
});

Deno.test("the same listing is new to each independent watch", async () => {
  const { kv, store } = await freshStore();
  try {
    const first = await store.createWatch(request);
    const second = await store.createWatch({
      ...request,
      location: "New Jersey",
    });
    const source = new FakeSource(() => Promise.resolve(result([listing])));
    assertEquals((await store.runWatch(first, source)).newForWatch, 1);
    assertEquals((await store.runWatch(second, source)).newForWatch, 1);
  } finally {
    await kv.close();
  }
});

Deno.test("failed source search records a failed run without listing writes", async () => {
  const { kv, store } = await freshStore();
  try {
    const watch = await store.createWatch(request);
    const failure = Object.assign(new Error("challenge"), {
      code: "ACCESS_CHALLENGE",
    });
    await store.runWatch(watch, new FakeSource(() => Promise.reject(failure)))
      .catch(() => undefined);
    const runs = [];
    for await (
      const entry of kv.list<{ status: string }>({ prefix: ["search_runs"] })
    ) runs.push(entry.value);
    assertEquals(runs.length, 1);
    assertEquals(runs[0].status, "failed");
    assertEquals(await store.getListing((await sourceKey(listing))!), undefined);
  } finally {
    await kv.close();
  }
});
