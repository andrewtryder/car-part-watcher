import { assertEquals } from "jsr:@std/assert@1.0.19";
import {
  authorizeConsoleRequest,
  validateConsoleAuthConfig,
  withConsoleAuthentication,
} from "../src/console_auth.ts";

const config = {
  enabled: true,
  username: "operator",
  password: "test-password",
};
const request = (path: string, authorization?: string, method = "GET") =>
  new Request(`https://console.test${path}`, {
    method,
    headers: authorization ? { authorization } : undefined,
  });
const basic = (username = config.username, password = config.password) =>
  `Basic ${btoa(`${username}:${password}`)}`;
const environment = (values: Record<string, string | undefined>) => ({
  get: (name: string) => values[name],
});

Deno.test("startup validation permits explicitly disabled local auth", () => {
  assertEquals(
    validateConsoleAuthConfig(environment({ APP_ENV: "development" })),
    { enabled: false, username: undefined, password: undefined },
  );
});

Deno.test("startup validation requires complete authentication configuration", () => {
  assertEquals(
    validateConsoleAuthConfig(environment({
      APP_ENV: "production",
      CONSOLE_AUTH_ENABLED: "true",
      CONSOLE_USERNAME: "operator",
      CONSOLE_PASSWORD: "test-password",
    })),
    config,
  );
  for (
    const values of [
      {
        CONSOLE_AUTH_ENABLED: "true",
        CONSOLE_PASSWORD: "test-password",
      },
      {
        CONSOLE_AUTH_ENABLED: "true",
        CONSOLE_USERNAME: "operator",
      },
      { APP_ENV: "production", CONSOLE_AUTH_ENABLED: "false" },
      { DENO_DEPLOYMENT_ID: "deployment", CONSOLE_AUTH_ENABLED: "false" },
    ]
  ) {
    let failed = false;
    try {
      validateConsoleAuthConfig(environment(values));
    } catch (error) {
      failed = error instanceof Error &&
        !error.message.includes("operator") &&
        !error.message.includes("test-password");
    }
    assertEquals(failed, true);
  }
});

Deno.test("health is public while the root requires valid Basic credentials", async () => {
  let reached = false;
  const health = await withConsoleAuthentication(
    request("/health"),
    () => {
      reached = true;
      return new Response("protected");
    },
    config,
  );
  assertEquals(health.status, 200);
  assertEquals(await health.json(), { ok: true });
  assertEquals(reached, false);

  const anonymous = await withConsoleAuthentication(
    request("/"),
    () => new Response("protected"),
    config,
  );
  assertEquals(anonymous.status, 401);
  assertEquals(
    anonymous.headers.get("www-authenticate"),
    'Basic realm="Car Part Watcher"',
  );

  const authenticated = await withConsoleAuthentication(
    request("/", basic()),
    () => new Response("spa"),
    config,
  );
  assertEquals(authenticated.status, 200);
  assertEquals(await authenticated.text(), "spa");
});

Deno.test("administrative API and mutation requests stop before their handlers", async () => {
  let calls = 0;
  const next = () => {
    calls++;
    return new Response("handler reached");
  };
  for (
    const entry of [
      request("/assets/index.js"),
      request("/api/dashboard"),
      request("/api/catalog/refresh", undefined, "POST"),
      request("/api/watches/id/run", undefined, "POST"),
      request("/api/notifications/mark-all-read", undefined, "POST"),
    ]
  ) {
    assertEquals(
      (await withConsoleAuthentication(entry, next, config)).status,
      401,
    );
  }
  assertEquals(calls, 0);
  assertEquals(
    (await withConsoleAuthentication(
      request("/api/dashboard", basic()),
      next,
      config,
    )).status,
    200,
  );
  assertEquals(calls, 1);
});

Deno.test("missing configuration fails closed and malformed credentials do not crash", async () => {
  assertEquals(
    (await authorizeConsoleRequest(request("/"), { enabled: true }))?.status,
    503,
  );
  for (
    const header of [
      "Basic",
      "Basic !!!",
      "Bearer token",
      basic("operator", ""),
      basic("wrong", "test-password"),
    ]
  ) {
    assertEquals(
      (await authorizeConsoleRequest(request("/", header), config))?.status,
      401,
    );
  }
});

Deno.test("authentication is disabled unless explicitly enabled", async () => {
  let reached = false;
  const response = await withConsoleAuthentication(
    request("/api/dashboard"),
    () => {
      reached = true;
      return new Response("handler reached");
    },
    {},
  );
  assertEquals(response.status, 200);
  assertEquals(reached, true);
});
