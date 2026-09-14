import { getEmailNotificationSettings } from "../src/repositories/email_notification_settings_repository.ts";
import { GmailNotifier } from "../src/services/gmail_notifier.ts";

const settings = await getEmailNotificationSettings();
if (!settings.enabled) throw new Error("Email delivery is disabled");
await new GmailNotifier(settings).deliver({ version: 1, eventId: crypto.randomUUID(), eventType: "new_listing", watch: { id: "configuration-test", name: "TEST" }, listing: { id: "configuration-test", title: "Email delivery configured" }, schedule: { slot: "test" } });
console.log("Email delivery test accepted by SMTP");
