import { registerCron } from "./src/cron.ts";
import { BrowserlessCarPartSearchClient } from "./src/search/car_part_search_client.ts";
import {
  validateConsoleAuthConfig,
  withConsoleAuthentication,
} from "./src/console_auth.ts";
import { routeRequest } from "./src/http/router.ts";

const searchClient = new BrowserlessCarPartSearchClient();
const consoleAuth = validateConsoleAuthConfig();
registerCron(searchClient);

export async function handleConsoleRequest(req: Request): Promise<Response> {
  return await routeRequest(req, searchClient);
}

Deno.serve((req) =>
  withConsoleAuthentication(
    req,
    () => handleConsoleRequest(req),
    consoleAuth,
  )
);
