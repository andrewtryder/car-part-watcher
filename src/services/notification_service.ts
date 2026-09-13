import { claimNotificationEvents, markDelivered, markFailed, type NotificationEvent } from "../repositories/notification_repository.ts";

export interface Notifier { deliver(event: NotificationEvent): Promise<void>; }
export class LoggingNotifier implements Notifier {
  async deliver(event: NotificationEvent) {
    const p = event.payload;
    console.log(`[notification] watch=${JSON.stringify(p.watchName)} listing=${[p.year, p.makeModel, p.part].filter(Boolean).join(" ")} stock=${p.stockNumber ?? ""} price=${p.priceDisplay ?? ""} recycler=${JSON.stringify(p.recyclerName ?? "")}`);
  }
}
export async function processNotificationOutbox(notifier: Notifier = new LoggingNotifier()) {
  const events = await claimNotificationEvents(); let delivered = 0; let failed = 0;
  for (const event of events) try { await notifier.deliver(event); await markDelivered(event.id); delivered++; } catch (error) { await markFailed(event.id, event.attempts, "NOTIFIER_FAILED", error instanceof Error ? error.message : "Notifier failed"); failed++; }
  return { claimed: events.length, delivered, failed };
}
