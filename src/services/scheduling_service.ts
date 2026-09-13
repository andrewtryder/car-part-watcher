import { listScheduledWatches } from "../repositories/watch_repository.ts";
import { executeWatch } from "./reconciliation_service.ts";

export type ScheduleSlot = "morning" | "afternoon" | "evening";
const slotHours: Record<ScheduleSlot, number> = { morning: 8, afternoon: 14, evening: 20 };
export const appTimezone = () => Deno.env.get("APP_TIMEZONE") || "America/New_York";
export function localSlot(date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: appTimezone(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}
export async function scheduledWatchDispatcher(slot: ScheduleSlot, now = new Date()) {
  const local = localSlot(now); if (local.hour !== slotHours[slot]) return { slot, skipped: "outside_window", attempted: 0, completed: 0, failed: 0 };
  const watches = await listScheduledWatches(slot); let completed = 0; let failed = 0;
  for (const watch of watches) try {
    const result = await executeWatch(watch.id, {
      runType: "scheduled",
      scheduledKey: `watch:${watch.id}:${local.date}:${slot}`,
      scheduleSlot: slot,
    });
    if (result) completed++;
  } catch (error) { failed++; console.error(`scheduled watch ${watch.id} failed`, error instanceof Error ? error.message : "unknown"); }
  return { slot, attempted: watches.length, completed, failed };
}
