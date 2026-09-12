import { BrowserlessBrowserProvider } from "./browser/browserless_browser_provider.ts";
import { runCarPartSearch } from "./browser/car_part_browser.ts";
import { SpikeError } from "./types.ts";

const stages: string[] = [];
try {
  const result = await runCarPartSearch(
    new BrowserlessBrowserProvider((stage) => stages.push(stage)),
    undefined,
    (stage) => stages.push(stage),
  );
  console.log(JSON.stringify({ stages, result }, null, 2));
} catch (error) {
  const body = error instanceof SpikeError ? error.toJSON() : {
    error: { code: "UNEXPECTED_PAGE", message: "Unexpected spike failure" },
  };
  console.log(JSON.stringify({ stages, ...body }, null, 2));
  Deno.exitCode = 1;
}
