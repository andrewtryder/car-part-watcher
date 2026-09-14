import type { EmailNotificationSettings } from "../repositories/email_notification_settings_repository.ts";
import type { NotificationEventV1 } from "./notification_service.ts";

export function emailTestPlan(args: string[], settings: EmailNotificationSettings) {
  const values = new Set(args.filter((arg) => arg !== "--"));
  const testIdAt = args.indexOf("--test-id");
  const testId = testIdAt >= 0 ? args[testIdAt + 1] : "manual";
  const send = values.has("--send") && values.has("--confirm") && values.has("SEND_TEST_EMAIL") && values.has("--allow-production");
  return { send, testId: /^[A-Za-z0-9._-]{1,80}$/.test(testId ?? "") ? testId : "invalid", summary: { enabled: settings.enabled, toAddress: settings.toAddress, fromName: settings.fromName, subjectPrefix: settings.subjectPrefix } };
}

export async function runEmailTestCommand(
  args: string[],
  settings: EmailNotificationSettings,
  deliver: (event: NotificationEventV1) => Promise<void>,
) {
  const plan = emailTestPlan(args, settings);
  if (!plan.send) return plan;
  if (!settings.enabled) throw new Error("Email delivery is disabled");
  if (plan.testId === "invalid") throw new Error("--test-id must use only letters, numbers, dots, underscores, or hyphens");
  await deliver({ version: 1, eventId: `email-test-${plan.testId}`, eventType: "new_listing", watch: { id: "configuration-test", name: "TEST" }, listing: { id: "configuration-test", title: "Email delivery configured" }, schedule: { slot: "test" } });
  return plan;
}
