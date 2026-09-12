import { LightpandaBrowserProvider } from "./browser/lightpanda_browser_provider.ts";
import { runCarPartSearch } from "./browser/car_part_browser.ts";
import { SpikeError } from "./types.ts";

const stages: string[] = [];
try {
  const result = await runCarPartSearch(
    new LightpandaBrowserProvider(),
    undefined,
    (stage) => stages.push(stage),
  );
  console.log(JSON.stringify({ stages, result }, null, 2));
} catch (error) {
  const structured = error instanceof SpikeError
    ? error.toJSON()
    : { error: { code: "LIGHTPANDA_INCOMPATIBLE", message: String(error) } };
  console.log(JSON.stringify({ stages, ...structured }, null, 2));
  Deno.exitCode = 1;
}
