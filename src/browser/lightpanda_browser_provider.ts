import {
  type Browser,
  type BrowserContext,
  chromium,
} from "npm:playwright-core@1.58.2";
import { createHash } from "node:crypto";
import type { BrowserProvider, BrowserSession } from "./car_part_browser.ts";
import { SpikeError } from "../types.ts";

const lightpandaVersion = "0.4.0";
const linuxAssets: Record<string, { asset: string; sha256: string }> = {
  x86_64: {
    asset: "lightpanda-x86_64-linux",
    sha256: "bfcf9bd7e80939b87232aa114a49d8f397f51af0c2632d9fc58d4a6d4386624f",
  },
  aarch64: {
    asset: "lightpanda-aarch64-linux",
    sha256: "5e3b54deed642ffeb2b8f24a1931e54c51161f44d9d728135da3d4863cb722fb",
  },
};

async function unusedLocalPort(): Promise<number> {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  try {
    return (listener.addr as Deno.NetAddr).port;
  } finally {
    listener.close();
  }
}

async function waitForCdp(
  endpoint: string,
  child: Deno.ChildProcess,
): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) return;
    } catch { /* Lightpanda is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill("SIGTERM");
  throw new SpikeError(
    "BROWSER_START_FAILED",
    "Lightpanda did not expose its CDP endpoint within 8 seconds",
    { endpoint },
  );
}

/** Starts a pinned local Lightpanda executable and attaches through CDP. */
export class LightpandaBrowserProvider implements BrowserProvider {
  constructor(
    private readonly executablePath = Deno.env.get("LIGHTPANDA_PATH"),
  ) {}

  async createSession(): Promise<BrowserSession> {
    if (!this.executablePath) {
      throw new SpikeError(
        "BROWSER_START_FAILED",
        "LIGHTPANDA_PATH must point to a verified Lightpanda executable",
      );
    }
    const port = await unusedLocalPort();
    const endpoint = `http://127.0.0.1:${port}`;
    let child: Deno.ChildProcess;
    try {
      child = new Deno.Command(this.executablePath, {
        args: ["serve", "--host", "127.0.0.1", "--port", String(port)],
        stdout: "piped",
        stderr: "piped",
      }).spawn();
    } catch (cause) {
      throw new SpikeError(
        "BROWSER_START_FAILED",
        "Could not start Lightpanda",
        { cause: String(cause) },
      );
    }
    await waitForCdp(endpoint, child);
    let browser: Browser;
    try {
      browser = await chromium.connectOverCDP(endpoint);
    } catch (cause) {
      child.kill("SIGTERM");
      throw new SpikeError(
        "CDP_CONNECTION_FAILED",
        "Playwright Core could not attach to Lightpanda CDP",
        { cause: String(cause), endpoint },
      );
    }
    const context = await browser.newContext() as BrowserContext;
    return {
      context,
      async close() {
        await browser.close().catch(() => undefined);
        child.kill("SIGTERM");
        await child.status.catch(() => undefined);
      },
    };
  }
}

/** Downloads only a pinned, checksum-verified Linux release into a runtime temp directory. */
export async function provisionLightpandaForCurrentRuntime(): Promise<
  LightpandaBrowserProvider
> {
  if (Deno.build.os !== "linux") {
    throw new SpikeError(
      "BROWSER_START_FAILED",
      "Automatic Lightpanda provisioning is only defined for Linux",
      { os: Deno.build.os, arch: Deno.build.arch },
    );
  }
  const asset = linuxAssets[Deno.build.arch];
  if (!asset) {
    throw new SpikeError(
      "BROWSER_START_FAILED",
      "No pinned Lightpanda asset matches this runtime architecture",
      { arch: Deno.build.arch },
    );
  }
  const url =
    `https://github.com/lightpanda-io/browser/releases/download/${lightpandaVersion}/${asset.asset}`;
  const directory = await Deno.makeTempDir({
    prefix: `lightpanda-${lightpandaVersion}-`,
  });
  const executablePath = `${directory}/${asset.asset}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error("response body is empty");
    const file = await Deno.open(executablePath, {
      write: true,
      create: true,
      mode: 0o755,
    });
    const hash = createHash("sha256");
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        hash.update(value);
        await file.write(value);
      }
    } finally {
      file.close();
      reader.releaseLock();
    }
    const digest = hash.digest("hex");
    if (digest !== asset.sha256) {
      throw new Error(
        `checksum mismatch: expected ${asset.sha256}, received ${digest}`,
      );
    }
  } catch (cause) {
    throw new SpikeError(
      "BROWSER_START_FAILED",
      "Could not download and verify pinned Lightpanda release",
      { url, cause: String(cause) },
    );
  }
  return new LightpandaBrowserProvider(executablePath);
}
