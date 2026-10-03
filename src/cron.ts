import { recoverStaleRuns } from "./repositories/search_run_repository.ts";
import { processNotificationOutbox } from "./services/notification_service.ts";
import { scheduledWatchDispatcher } from "./services/scheduling_service.ts";
import type { CarPartSearchClient } from "./search/car_part_search_client.ts";

// Deno Cron schedules are UTC. The hourly dispatcher maps each invocation into
// America/New_York (or APP_TIMEZONE) application slots with durable dedup keys.
export function registerCron(searchClient: CarPartSearchClient) {
  Deno.cron("watch schedule dispatcher", "0 * * * *", async () => {
    for (const slot of ["morning", "afternoon", "evening"] as const) {
      await scheduledWatchDispatcher(searchClient, slot);
    }
  });
  Deno.cron("notification outbox drain", "*/15 * * * *", async () => {
    await recoverStaleRuns(10);
    await processNotificationOutbox();
  });
}
