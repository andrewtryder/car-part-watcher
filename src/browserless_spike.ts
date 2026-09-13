import { BrowserlessBrowserProvider } from "./browser/browserless_browser_provider.ts";
import { runCarPartSearch } from "./browser/car_part_browser.ts";
import { SpikeError } from "./types.ts";

const stages: string[] = [];
try {
  const provider = new BrowserlessBrowserProvider((stage) =>
    stages.push(stage)
  );
  if (Deno.args.includes("--launch-only")) {
    const session = await provider.createSession();
    let browserVersion: string | undefined;
    let aboutBlankUrl: string | undefined;
    try {
      const page = session.page ?? await session.context.newPage();
      await page.goto("about:blank");
      browserVersion = session.runtimeInfo?.browserVersion;
      aboutBlankUrl = page.url();
    } finally {
      await session.close();
      stages.push("browser session closed");
    }
    console.log(JSON.stringify(
      {
        apiKeyPresent: Boolean(
          Deno.env.get("BROWSERLESS_API_KEY") ??
            Deno.env.get("BROWSERLESS_TOKEN"),
        ),
        endpointHost: new URL(
          Deno.env.get("BROWSERLESS_ENDPOINT") ??
            "wss://production-sfo.browserless.io",
        ).host,
        provider: "BrowserlessBrowserProvider",
        stages,
        browserVersion,
        aboutBlankUrl,
      },
      null,
      2,
    ));
  } else {
    const result = await runCarPartSearch(
      provider,
      undefined,
      (stage) => stages.push(stage),
    );
    console.log(JSON.stringify(
      {
        stages,
        result: {
          search: result.search,
          refinement: result.refinement,
          resultCount: result.results.count,
          hasNextPage: result.results.hasNextPage,
          timings: result.timings,
        },
      },
      null,
      2,
    ));
  }
} catch (error) {
  const body = error instanceof SpikeError ? error.toJSON() : {
    error: { code: "UNEXPECTED_PAGE", message: "Unexpected spike failure" },
  };
  console.log(JSON.stringify({ stages, ...body }, null, 2));
  Deno.exitCode = 1;
}
