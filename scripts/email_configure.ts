import { getEmailNotificationSettings, saveEmailNotificationSettings } from "../src/repositories/email_notification_settings_repository.ts";

const args = new Set(Deno.args.filter((arg) => arg !== "--"));
if (args.has("--disable")) {
  const current = await getEmailNotificationSettings();
  const saved = await saveEmailNotificationSettings({ ...current, enabled: false });
  console.log(JSON.stringify({ enabled: saved.enabled, toAddress: saved.toAddress }));
} else if (args.has("--enable") && args.has("--use-gmail-address")) {
  const toAddress = Deno.env.get("GMAIL_USERNAME");
  if (!toAddress) throw new Error("GMAIL_USERNAME is required to configure email delivery");
  const appBaseUrl = Deno.env.get("APP_BASE_URL");
  if (!appBaseUrl) throw new Error("APP_BASE_URL is required to configure email delivery");
  const saved = await saveEmailNotificationSettings({ enabled: true, toAddress, fromName: "Car Part Watcher", subjectPrefix: "[Car Part Watcher]", appBaseUrl });
  console.log(JSON.stringify({ enabled: saved.enabled, toAddress: saved.toAddress, fromName: saved.fromName, subjectPrefix: saved.subjectPrefix, appBaseUrl: saved.appBaseUrl }));
} else {
  throw new Error("Use --enable --use-gmail-address or --disable");
}
