import { processNotificationOutbox } from "./services/notification_service.ts";
import { scheduledWatchDispatcher } from "./services/scheduling_service.ts";

// Deno Cron schedules are UTC. The hourly dispatcher maps each invocation into
// America/New_York (or APP_TIMEZONE) application slots with durable dedup keys.
Deno.cron("watch schedule dispatcher", "0 * * * *", async () => {
  for (const slot of ["morning", "afternoon", "evening"] as const) await scheduledWatchDispatcher(slot);
});
Deno.cron("notification outbox drain", "*/15 * * * *", async () => { await processNotificationOutbox(); });
