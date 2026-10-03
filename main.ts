import "./src/cron.ts";
import { withConsoleAuthentication } from "./src/console_auth.ts";
import { routeRequest } from "./src/http/router.ts";

export async function handleConsoleRequest(req: Request): Promise<Response> {
  return await routeRequest(req);
}

Deno.serve((req) =>
  withConsoleAuthentication(
    req,
    () => handleConsoleRequest(req),
  )
);
