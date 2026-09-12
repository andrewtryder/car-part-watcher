import {
  type BrowserMode,
  ChromeBrowserProvider,
  runCarPartSearch,
} from "./browser/car_part_browser.ts";
import { SpikeError } from "./types.ts";

const modes = new Set<BrowserMode>([
  "chrome-headed",
  "chrome-headless",
  "chromium-new-headless",
  "chromium-headless-shell",
]);
const mode = Deno.args.find((argument) => argument !== "--") as
  | BrowserMode
  | undefined;
const launchOnly = Deno.args.includes("--launch-only");
if (!mode || !modes.has(mode)) {
  console.error(`Usage: deno task browser-matrix -- <${[...modes].join("|")}>`);
  Deno.exit(2);
}

const stageNames: Record<string, string> = {
  "homepage load": "homepage_load",
  "search options extracted": "options_parse",
  "initial form submitted": "initial_form_submit",
  "refinement page reached": "refinement_detect",
  "refinement submitted": "refinement_submit",
  "results page reached": "results_detect",
  "results parsed": "results_parse",
  "next-page detected": "complete",
};
let lastSuccessfulStage = "browser_start";

try {
  if (launchOnly) {
    const session = await new ChromeBrowserProvider(mode).createSession();
    try {
      console.log(JSON.stringify(
        {
          mode,
          outcome: "LAUNCH_SUCCESS",
          runtime: session.runtimeInfo,
        },
        null,
        2,
      ));
    } finally {
      await session.close();
    }
    Deno.exit();
  }
  const result = await runCarPartSearch(
    new ChromeBrowserProvider(mode),
    undefined,
    (stage) => {
      if (stageNames[stage]) lastSuccessfulStage = stageNames[stage];
    },
  );
  console.log(JSON.stringify(
    {
      mode,
      outcome: "SUCCESS",
      lastSuccessfulStage: "complete",
      listingCount: result.results.count,
      hasNextPage: result.results.hasNextPage,
      timings: result.timings,
      runtime: result.runtimeInfo,
    },
    null,
    2,
  ));
} catch (error) {
  const details = error instanceof SpikeError && error.details &&
      typeof error.details === "object"
    ? error.details as Record<string, unknown>
    : {};
  console.log(JSON.stringify(
    {
      mode,
      outcome: error instanceof SpikeError ? error.code : "UNEXPECTED_PAGE",
      lastSuccessfulStage,
      stage: details.stage,
      error: error instanceof SpikeError ? error.toJSON().error : {
        code: "UNEXPECTED_PAGE",
        message: String(error),
      },
    },
    null,
    2,
  ));
  Deno.exitCode = 1;
}
