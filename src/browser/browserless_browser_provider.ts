import { type Browser, chromium } from "npm:playwright-core@1.58.2";
import type { BrowserProvider, BrowserSession } from "./car_part_browser.ts";
import { SpikeError } from "../types.ts";

const defaultEndpoint = "wss://production-sfo.browserless.io";
const sessionTimeoutMs = 60_000;

function sanitizeRemoteCause(cause: unknown): string {
  return String(cause).replace(/([?&]token=)[^&\s)]+/gi, "$1<redacted>");
}

function browserlessCdpUrl(): string {
  const token = Deno.env.get("BROWSERLESS_TOKEN");
  if (!token) {
    throw new SpikeError(
      "REMOTE_BROWSER_CREATE_FAILED",
      "BROWSERLESS_TOKEN is required for the remote Chrome experiment",
      { stage: "remote_session_create" },
    );
  }
  let endpoint: URL;
  try {
    endpoint = new URL(Deno.env.get("BROWSERLESS_ENDPOINT") ?? defaultEndpoint);
  } catch (cause) {
    throw new SpikeError(
      "REMOTE_BROWSER_CREATE_FAILED",
      "BROWSERLESS_ENDPOINT must be a WebSocket URL",
      { stage: "remote_session_create", cause: sanitizeRemoteCause(cause) },
    );
  }
  if (endpoint.protocol !== "ws:" && endpoint.protocol !== "wss:") {
    throw new SpikeError(
      "REMOTE_BROWSER_CREATE_FAILED",
      "BROWSERLESS_ENDPOINT must use ws or wss",
      { stage: "remote_session_create" },
    );
  }
  const configuredPath = endpoint.pathname.replace(/\/$/, "");
  if (configuredPath && configuredPath !== "/chrome") {
    throw new SpikeError(
      "REMOTE_BROWSER_CREATE_FAILED",
      "BROWSERLESS_ENDPOINT must be the service origin or its /chrome CDP route",
      { stage: "remote_session_create" },
    );
  }
  endpoint.pathname = "/chrome";
  endpoint.search = "";
  endpoint.searchParams.set("token", token);
  endpoint.searchParams.set("headless", "false");
  endpoint.searchParams.set("timeout", String(sessionTimeoutMs));
  endpoint.searchParams.set(
    "launch",
    JSON.stringify({ args: ["--window-size=1280,900"] }),
  );
  return endpoint.toString();
}

/** Connects to Browserless's ordinary Google Chrome CDP route. */
export class BrowserlessBrowserProvider implements BrowserProvider {
  constructor(private readonly onStage: (stage: string) => void = () => {}) {}

  async createSession(): Promise<BrowserSession> {
    const endpoint = browserlessCdpUrl();
    this.onStage("remote session created");
    const startedAt = performance.now();
    let browser: Browser;
    try {
      browser = await chromium.connectOverCDP(endpoint, { timeout: 15_000 });
    } catch (cause) {
      throw new SpikeError(
        "REMOTE_CDP_CONNECTION_FAILED",
        "Could not connect to Browserless Chrome over CDP",
        { stage: "remote_cdp_connect", cause: sanitizeRemoteCause(cause) },
      );
    }
    const cdpConnectMs = Math.round(performance.now() - startedAt);
    const context = browser.contexts()[0];
    if (!context) {
      await browser.close().catch(() => undefined);
      throw new SpikeError(
        "REMOTE_BROWSER_CREATE_FAILED",
        "Browserless did not provide its default browser context",
        { stage: "remote_session_create" },
      );
    }
    const page = context.pages()[0] ?? await context.newPage();
    this.onStage("CDP connected");
    return {
      context,
      page,
      timings: { sessionCreateMs: cdpConnectMs, cdpConnectMs },
      async close() {
        await browser.close().catch(() => undefined);
      },
    };
  }
}
