import {
  LocalBrowserProvider,
  runCarPartSearch,
} from "./browser/car_part_browser.ts";
import { SpikeError } from "./types.ts";

try {
  console.log(
    JSON.stringify(await runCarPartSearch(new LocalBrowserProvider()), null, 2),
  );
} catch (error) {
  if (error instanceof SpikeError) {
    console.log(JSON.stringify(error.toJSON(), null, 2));
  } else {console.log(
      JSON.stringify(
        { error: { code: "UNEXPECTED_PAGE", message: String(error) } },
        null,
        2,
      ),
    );}
  Deno.exitCode = 1;
}
