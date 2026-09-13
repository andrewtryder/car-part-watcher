import { assertEquals } from "jsr:@std/assert@1.0.19";
import { mapSearchRun } from "../src/repositories/search_run_repository.ts";

Deno.test("search run read model retains its run type", () => {
  const run = mapSearchRun({
    id: "run-1",
    watch_id: "watch-1",
    run_type: "scheduled",
    status: "succeeded",
    started_at: new Date("2026-01-02T03:04:05.000Z"),
    completed_at: new Date("2026-01-02T03:04:10.000Z"),
    listing_count: 3,
    new_listing_count: 1,
    changed_count: 0,
    pages_fetched: 1,
  });

  assertEquals(run.runType, "scheduled");
  assertEquals(run.startedAt, "2026-01-02T03:04:05.000Z");
});
