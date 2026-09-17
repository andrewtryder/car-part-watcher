import { getDatabase } from "../db/database.ts";
import type { Sql } from "./listing_repository.ts";

export interface NotificationEvent {
  id: string;
  watchId: string;
  searchRunId: string;
  listingId?: string;
  eventType: "new_listing" | "listing_updated";
  payload: unknown;
  status: "pending" | "processing" | "delivered" | "failed";
  attempts: number;
  availableAt: string;
  processedAt?: string;
  readAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt: string;
}
const parsePayload = (value: unknown): unknown => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};
const map = (row: any): NotificationEvent => ({
  id: row.id,
  watchId: row.watch_id,
  searchRunId: row.search_run_id,
  listingId: row.listing_id ?? undefined,
  eventType: row.event_type,
  payload: parsePayload(row.payload),
  status: row.status,
  attempts: row.attempts,
  availableAt: row.available_at.toISOString(),
  processedAt: row.processed_at?.toISOString(),
  readAt: row.read_at?.toISOString(),
  lastErrorCode: row.last_error_code ?? undefined,
  lastErrorMessage: row.last_error_message ?? undefined,
  createdAt: row.created_at.toISOString(),
});

export async function createNewListingEvent(
  sql: Sql,
  input: {
    id?: string;
    watchId: string;
    searchRunId: string;
    listingId: string;
    payload: unknown;
  },
) {
  const id = input.id ?? crypto.randomUUID();
  await sql`insert into notification_events (id,watch_id,search_run_id,event_type,listing_id,payload) values (${id},${input.watchId},${input.searchRunId},'new_listing',${input.listingId},${
    JSON.stringify(input.payload)
  }::jsonb) on conflict (search_run_id,listing_id,event_type) do nothing`;
}
export async function createListingUpdatedEvent(
  sql: Sql,
  input: {
    id?: string;
    watchId: string;
    searchRunId: string;
    listingId: string;
    payload: unknown;
  },
) {
  const id = input.id ?? crypto.randomUUID();
  await sql`insert into notification_events (id,watch_id,search_run_id,event_type,listing_id,payload,status,processed_at) values (${id},${input.watchId},${input.searchRunId},'listing_updated',${input.listingId},${
    JSON.stringify(input.payload)
  }::jsonb,'delivered',now()) on conflict (search_run_id,listing_id,event_type) do nothing`;
}
export async function claimNotificationEvents(limit = 20) {
  return await getDatabase().begin(async (sql) => {
    const rows =
      await sql`select * from notification_events where status='pending' and available_at <= now() order by created_at for update skip locked limit ${limit}`;
    for (const row of rows) {
      await sql`update notification_events set status='processing',attempts=attempts+1,updated_at=now() where id=${row.id}`;
    }
    return rows.map((row: any) => ({
      ...map(row),
      status: "processing" as const,
      attempts: row.attempts + 1,
    }));
  });
}
export async function markDelivered(id: string) {
  await getDatabase()`update notification_events set status='delivered',processed_at=now(),updated_at=now() where id=${id}`;
}
export async function markFailed(
  id: string,
  attempts: number,
  code: string,
  message: string,
  options?: { terminal?: boolean },
) {
  const terminal = options?.terminal ?? attempts >= 3;
  const delayMinutes = Math.min(60, 5 * 2 ** Math.max(0, attempts - 1));
  await getDatabase()`update notification_events set status=${
    terminal ? "failed" : "pending"
  },available_at=now() + (${delayMinutes} * interval '1 minute'),last_error_code=${code},last_error_message=${
    message.slice(0, 500)
  },updated_at=now() where id=${id}`;
}
export async function listNotificationEvents() {
  return (await getDatabase()`select * from notification_events order by created_at desc limit 50`)
    .map(map);
}
export async function listInboxNotifications(
  options: { unread?: boolean; watchId?: string; limit?: number; eventType?: string } = {},
) {
  const sql = getDatabase();
  const watchId = options.watchId ?? null;
  const eventType = options.eventType ?? null;
  const rows =
    await sql`select * from notification_events where (${eventType}::text is null and event_type in ('new_listing', 'listing_updated') or event_type = ${eventType}) and (${
      options.unread ?? true
    }=false or read_at is null) and (${watchId}::uuid is null or watch_id=${watchId}::uuid) order by created_at desc limit ${
      Math.min(options.limit ?? 50, 100)
    }`;
  const unread =
    await sql`select count(*)::int as count from notification_events where (${eventType}::text is null and event_type in ('new_listing', 'listing_updated') or event_type = ${eventType}) and read_at is null`;
  return { items: rows.map(map), unreadCount: unread[0].count };
}
export async function markNotificationRead(id: string) {
  await getDatabase()`update notification_events set read_at=coalesce(read_at,now()),updated_at=now() where id=${id}`;
}
export async function markAllNotificationsRead(watchId?: string) {
  const id = watchId ?? null;
  await getDatabase()`update notification_events set read_at=coalesce(read_at,now()),updated_at=now() where event_type in ('new_listing', 'listing_updated') and read_at is null and (${id}::uuid is null or watch_id=${id}::uuid)`;
}
export async function notificationCounts() {
  const rows =
    await getDatabase()`select status,count(*)::int as count from notification_events group by status`;
  return Object.fromEntries(rows.map((row: any) => [row.status, row.count]));
}
export async function retryNotificationEvent(id: string) {
  await getDatabase()`update notification_events set status='pending',available_at=now(),last_error_code=null,last_error_message=null,updated_at=now() where id=${id} and status='failed'`;
}
