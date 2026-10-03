const encoder = new TextEncoder();

export interface ConsoleAuthConfig {
  enabled?: boolean;
  username?: string;
  password?: string;
}

export interface ConsoleAuthEnvironment {
  get(name: string): string | undefined;
}

export function consoleAuthConfig(
  environment: ConsoleAuthEnvironment = Deno.env,
): ConsoleAuthConfig {
  const enabled = environment.get("CONSOLE_AUTH_ENABLED")?.trim().toLowerCase();
  return {
    // Authentication is enabled by default. Only an explicit "false" disables
    // the console/API boundary; unexpected values therefore fail closed.
    enabled: enabled !== "false",
    username: environment.get("CONSOLE_USERNAME"),
    password: environment.get("CONSOLE_PASSWORD"),
  };
}

/**
 * Validates console access before the server starts. Authentication defaults to
 * enabled in every environment; set CONSOLE_AUTH_ENABLED=false explicitly to
 * run the console and its API without Basic Authentication.
 */
export function validateConsoleAuthConfig(
  environment: ConsoleAuthEnvironment = Deno.env,
): ConsoleAuthConfig {
  const config = consoleAuthConfig(environment);
  if (config.enabled && (!config.username || !config.password)) {
    throw new Error(
      "Console authentication requires CONSOLE_USERNAME and CONSOLE_PASSWORD.",
    );
  }
  return config;
}

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Car Part Watcher"' },
  });
}

function unavailable() {
  return new Response("Console authentication is not configured.", {
    status: 503,
  });
}

function decodeCredentials(header: string | null) {
  const match = header?.match(/^Basic\s+([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return undefined;
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0)),
    );
    const separator = decoded.indexOf(":");
    if (separator <= 0 || separator === decoded.length - 1) return undefined;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return undefined;
  }
}

async function safeEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index++) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

export async function authorizeConsoleRequest(
  request: Request,
  config: ConsoleAuthConfig = consoleAuthConfig(),
) {
  if (!config.enabled) return undefined;
  if (!config.username || !config.password) return unavailable();
  const credentials = decodeCredentials(request.headers.get("authorization"));
  if (!credentials) return unauthorized();
  const [usernameMatches, passwordMatches] = await Promise.all([
    safeEqual(credentials.username, config.username),
    safeEqual(credentials.password, config.password),
  ]);
  return usernameMatches && passwordMatches ? undefined : unauthorized();
}

/**
 * `/health` is public. Basic Auth is enabled by default and can be explicitly
 * disabled with CONSOLE_AUTH_ENABLED=false.
 */
export async function withConsoleAuthentication(
  request: Request,
  next: () => Response | Promise<Response>,
  config: ConsoleAuthConfig = consoleAuthConfig(),
) {
  if (new URL(request.url).pathname === "/health" && request.method === "GET") {
    return Response.json({ ok: true });
  }
  return await authorizeConsoleRequest(request, config) ?? await next();
}
