import {
  listInboxNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  retryNotificationEvent,
} from "../repositories/notification_repository.ts";
import { json, parseLimitParam } from "./errors.ts";

export async function handleListNotifications(
  _req: Request,
  url: URL,
): Promise<Response> {
  return json(
    await listInboxNotifications({
      unread: url.searchParams.get("status") !== "all",
      watchId: url.searchParams.get("watchId") ?? undefined,
      limit: parseLimitParam(url.searchParams.get("limit"), 50, 100),
      eventType: url.searchParams.get("type") ?? undefined,
    }),
  );
}

export async function handleMarkAllNotificationsRead(
  req: Request,
): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  await markAllNotificationsRead(body.watchId);
  return json({ ok: true });
}

export async function handleMarkNotificationRead(
  id: string,
): Promise<Response> {
  await markNotificationRead(id);
  return json({ ok: true });
}

export async function handleRetryNotification(
  id: string,
): Promise<Response> {
  await retryNotificationEvent(id);
  return json({ ok: true });
}
