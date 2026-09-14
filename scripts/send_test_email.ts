import { getEmailNotificationSettings } from "../src/repositories/email_notification_settings_repository.ts";
import { GmailNotifier } from "../src/services/gmail_notifier.ts";
import { runEmailTestCommand } from "../src/services/email_test_command.ts";

const settings = await getEmailNotificationSettings();
const result = await runEmailTestCommand(Deno.args, settings, (event) =>
  new GmailNotifier(settings).deliver(event)
);
if (!result.send) {
  console.log(JSON.stringify({ dryRun: true, ...result.summary, required: "--send --confirm SEND_TEST_EMAIL --allow-production [--test-id <id>]" }));
} else {
  console.log(`Email delivery test accepted by SMTP (testId=${result.testId})`);
}
