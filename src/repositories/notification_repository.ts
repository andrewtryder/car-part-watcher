import { getDatabase } from "../db/database.ts";
import type { Sql } from "./listing_repository.ts";

export interface NotificationEvent {
  id: string;
  watchId: string;
  searchRunId: string;
  listingId?: string;
  eventType: "new_listing" | "listing_updated";
  payload: unknown;
  readAt?: string;
  deliveryId?: string;
  status?: "pending" | "processing" | "delivered" | "failed";
  attempts?: number;
  availableAt?: string;
  processedAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt: string;
}
export interface NotificationDelivery extends NotificationEvent {
  deliveryId: string;
  status: "pending" | "processing" | "delivered" | "failed";
  attempts: number;
  availableAt: string;
  processedAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
}
const parse = (value: unknown) =>
  typeof value === "string" ? JSON.parse(value) : value;
const map = (row: Record<string, unknown>): NotificationEvent => ({
  id: row.id as string,
  watchId: row.watch_id as string,
  searchRunId: row.search_run_id as string,
  listingId: row.listing_id as string | undefined,
  eventType: row.event_type as NotificationDelivery["eventType"],
  payload: parse(row.payload),
  readAt: (row.read_at as Date | undefined)?.toISOString(),
  createdAt: (row.created_at as Date).toISOString(),
  deliveryId: (row.delivery_id as string | null | undefined) ?? undefined,
  status: (row.status as NotificationDelivery["status"] | null | undefined) ??
    undefined,
  attempts: (row.attempts as number | null | undefined) ?? undefined,
  availableAt: (row.available_at as Date | undefined)?.toISOString(),
  processedAt: (row.processed_at as Date | undefined)?.toISOString(),
  lastErrorCode: (row.last_error_code as string | null | undefined) ??
    undefined,
  lastErrorMessage: (row.last_error_message as string | null | undefined) ??
    undefined,
});
async function createEvent(
  sql: Sql,
  input: {
    id?: string;
    watchId: string;
    searchRunId: string;
    listingId: string;
    payload: unknown;
    eventType: "new_listing" | "listing_updated";
    createDelivery?: boolean;
  },
) {
  const id = input.id ?? crypto.randomUUID();
  const rows =
    await sql`insert into notification_events (id,watch_id,search_run_id,event_type,listing_id,payload) values (${id},${input.watchId},${input.searchRunId},${input.eventType},${input.listingId},${
      JSON.stringify(input.payload)
    }::jsonb) on conflict (search_run_id,listing_id,event_type) do nothing returning id`;
  if (rows.length) {
    await sql`insert into notification_inbox_state (event_id) values (${id})`;
    if (input.createDelivery ?? true) {
      await sql`insert into notification_deliveries (id,event_id,channel) values (${crypto.randomUUID()},${id},'email')`;
    }
  }
}
export const createNewListingEvent = (
  sql: Sql,
  input: Omit<Parameters<typeof createEvent>[1], "eventType">,
) => createEvent(sql, { ...input, eventType: "new_listing" });
export const createListingUpdatedEvent = (
  sql: Sql,
  input: Omit<Parameters<typeof createEvent>[1], "eventType">,
) => createEvent(sql, { ...input, eventType: "listing_updated" });
const deliveryRowsFor = (where: string) =>
  `select e.*, i.read_at, d.id as delivery_id, d.status, d.attempts, d.available_at, d.processed_at, d.last_error_code, d.last_error_message from notification_deliveries d join notification_events e on e.id=d.event_id left join notification_inbox_state i on i.event_id=e.id ${where}`;
export async function claimNotificationEvents(
  limit = 20,
): Promise<NotificationDelivery[]> {
  return await getDatabase().begin(async (sql) => {
    const rows = await sql.unsafe(
      `${
        deliveryRowsFor(
          "where d.status='pending' and d.available_at <= now() order by d.created_at for update of d skip locked limit " +
            Math.max(1, Math.min(limit, 100)),
        )
      }`,
    );
    for (const row of rows) {
      await sql`update notification_deliveries set status='processing',attempts=attempts+1,updated_at=now() where id=${row.delivery_id}`;
    }
    return rows.map((row) => ({
      ...map(row as Record<string, unknown>),
      deliveryId: row.delivery_id as string,
      status: "processing" as const,
      attempts: (row.attempts as number) + 1,
      availableAt: (row.available_at as Date).toISOString(),
    }));
  });
}
export const markDelivered = (id: string) =>
  getDatabase()`update notification_deliveries set status='delivered',processed_at=now(),updated_at=now() where id=${id}`;
export async function markFailed(
  id: string,
  attempts: number,
  code: string,
  message: string,
  options?: { terminal?: boolean },
) {
  const terminal = options?.terminal ?? attempts >= 3;
  const minutes = Math.min(60, 5 * 2 ** Math.max(0, attempts - 1));
  await getDatabase()`update notification_deliveries set status=${
    terminal ? "failed" : "pending"
  },available_at=now() + (${minutes} * interval '1 minute'),last_error_code=${code},last_error_message=${
    message.slice(0, 500)
  },updated_at=now() where id=${id}`;
}
export async function listInboxNotifications(
  options: {
    unread?: boolean;
    watchId?: string;
    limit?: number;
    eventType?: string;
  } = {},
) {
  const watchId = options.watchId ?? null,
    type = options.eventType ?? null,
    limit = Math.min(Math.max(options.limit ?? 50, 1), 100),
    sql = getDatabase();
  const unread = options.unread ?? true;
  const rows =
    await sql`select e.*, i.read_at, d.id as delivery_id, d.status, d.attempts, d.available_at, d.processed_at, d.last_error_code, d.last_error_message from notification_events e join notification_inbox_state i on i.event_id=e.id left join notification_deliveries d on d.event_id=e.id where (${unread}=false or i.read_at is null) and (${type}::text is null or e.event_type=${type}) and (${watchId}::uuid is null or e.watch_id=${watchId}::uuid) order by e.created_at desc limit ${limit}`;
  const countRows =
    await sql`select count(*)::int as count from notification_events e join notification_inbox_state i on i.event_id=e.id where i.read_at is null and (${type}::text is null or e.event_type=${type}) and (${watchId}::uuid is null or e.watch_id=${watchId}::uuid)`;
  return {
    items: rows.map((row) => map(row as Record<string, unknown>)),
    unreadCount: countRows[0]?.count as number ?? 0,
  };
}
export const markNotificationRead = (id: string) =>
  getDatabase()`update notification_inbox_state set read_at=coalesce(read_at,now()) where event_id=${id}`;
export const markAllNotificationsRead = (watchId?: string) =>
  getDatabase()`update notification_inbox_state i set read_at=coalesce(i.read_at,now()) from notification_events e where e.id=i.event_id and (${
    watchId ?? null
  }::uuid is null or e.watch_id=${watchId ?? null}::uuid)`;
export async function notificationCounts() {
  const rows =
    await getDatabase()`select status,count(*)::int as count from notification_deliveries group by status`;
  return Object.fromEntries(
    rows.map((row) => [row.status as string, row.count as number]),
  );
}
export const retryNotificationEvent = (id: string) =>
  getDatabase()`update notification_deliveries set status='pending',available_at=now(),last_error_code=null,last_error_message=null,updated_at=now() where event_id=${id} and status='failed'`;
