import { getDatabase } from "../db/database.ts";

export interface EmailNotificationSettings {
  enabled: boolean;
  toAddress?: string;
  fromName: string;
  subjectPrefix: string;
  appBaseUrl?: string;
}

const map = (row: any): EmailNotificationSettings => ({
  enabled: row.enabled,
  toAddress: row.to_address ?? undefined,
  fromName: row.from_name,
  subjectPrefix: row.subject_prefix,
  appBaseUrl: row.app_base_url ?? undefined,
});

export async function getEmailNotificationSettings(): Promise<EmailNotificationSettings> {
  const rows = await getDatabase()`select * from email_notification_settings where id='default'`;
  if (rows[0]) return map(rows[0]);
  return { enabled: false, fromName: "Car Part Watcher", subjectPrefix: "[Car Part Watcher]" };
}

export async function saveEmailNotificationSettings(input: EmailNotificationSettings) {
  const rows = await getDatabase()`insert into email_notification_settings (id,enabled,to_address,from_name,subject_prefix,app_base_url) values ('default',${input.enabled},${input.toAddress ?? null},${input.fromName},${input.subjectPrefix},${input.appBaseUrl ?? null}) on conflict (id) do update set enabled=excluded.enabled,to_address=excluded.to_address,from_name=excluded.from_name,subject_prefix=excluded.subject_prefix,app_base_url=excluded.app_base_url,updated_at=now() returning *`;
  return map(rows[0]);
}
