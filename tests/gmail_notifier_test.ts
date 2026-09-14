import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.19";
import { GmailNotifier, renderNotificationEmail } from "../src/services/gmail_notifier.ts";
import type { NotificationEventV1 } from "../src/services/notification_service.ts";

const settings = { enabled: true, toAddress: "recipient@example.test", fromName: "Car Part Watcher", subjectPrefix: "[Car Part Watcher]", appBaseUrl: "https://car-part-watcher.example.test" };
const event: NotificationEventV1 = { version: 1, eventId: "event-1", eventType: "new_listing", watch: { id: "watch-1", name: "CRV Front Bumper" }, listing: { id: "listing-1", title: "2019 Honda CRV Bumper Assy (Front) includes cover", price: "$380", recyclerName: "TNA <Parts> & Co", location: "Concord, NH", stockNumber: "799239", grade: "C9cc", damageCode: "6S55D4", description: `<script> & "`, imageUrl: "https://image.test/thumb.jpg", photoUrl: "https://image.test/photos", quoteUrl: "https://image.test/quote" }, schedule: { slot: "morning" } };

Deno.test("renders complete escaped Gmail subject, text, and HTML", () => {
  const rendered = renderNotificationEmail(event, settings);
  assertEquals(rendered.subject, "[Car Part Watcher] CRV Front Bumper: New 2019 Honda CRV Bumper Assy (Front) includes cover — $380");
  for (const value of ["Price: $380", "Recycler: TNA <Parts> & Co", "Stock #: 799239", "Grade: C9cc", "Damage: 6S55D4", "https://car-part-watcher.example.test/watches/watch-1"]) assertStringIncludes(rendered.text, value);
  assertStringIncludes(rendered.html, "TNA &lt;Parts&gt; &amp; Co");
  assertStringIncludes(rendered.html, "&lt;script&gt; &amp; &quot;");
  assertStringIncludes(rendered.html, "https://image.test/photos");
  assertStringIncludes(rendered.html, "https://image.test/quote");
});

Deno.test("omits absent optional email fields and Gmail notifier delegates transport", async () => {
  const rendered = renderNotificationEmail({ ...event, listing: { id: "listing-2", title: "Part" } }, settings);
  assertEquals(rendered.subject, "[Car Part Watcher] CRV Front Bumper: New Part");
  assertEquals(rendered.text.includes("undefined"), false);
  let sent: Record<string, unknown> | undefined;
  const notifier = new GmailNotifier(settings, async (message) => { sent = message; }, () => ({ username: "sender@example.test", password: "test-password" }));
  await notifier.deliver(event);
  assertEquals(sent?.messageId, "<event-1@car-part-watcher>");
  assertEquals(sent?.to, "recipient@example.test");
});
