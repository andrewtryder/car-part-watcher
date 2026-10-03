import {
  listInboxNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  retryNotificationEvent,
} from "../repositories/notification_repository.ts";
import { json, parseLimitParam } from "./errors.ts";
import type {
  NotificationDto,
  NotificationListDto,
} from "../contracts/notifications.ts";
import type { OkResponseDto } from "../contracts/common.ts";

export async function handleListNotifications(
  _req: Request,
  url: URL,
): Promise<Response> {
  const notifications = await listInboxNotifications({
    unread: url.searchParams.get("status") !== "all",
    watchId: url.searchParams.get("watchId") ?? undefined,
    limit: parseLimitParam(url.searchParams.get("limit"), 50, 100),
    eventType: url.searchParams.get("type") ?? undefined,
  });
  return json<NotificationListDto>({
    ...notifications,
    items: notifications.items as NotificationDto[],
  });
}

export async function handleMarkAllNotificationsRead(
  req: Request,
): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  await markAllNotificationsRead(body.watchId);
  return json<OkResponseDto>({ ok: true });
}

export async function handleMarkNotificationRead(
  id: string,
): Promise<Response> {
  await markNotificationRead(id);
  return json<OkResponseDto>({ ok: true });
}

export async function handleRetryNotification(
  id: string,
): Promise<Response> {
  await retryNotificationEvent(id);
  return json<OkResponseDto>({ ok: true });
}
