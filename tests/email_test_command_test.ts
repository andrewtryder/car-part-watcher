import { assertEquals } from "jsr:@std/assert@1.0.19";
import { runEmailTestCommand } from "../src/services/email_test_command.ts";

const settings = { enabled: true, toAddress: "recipient@example.test", fromName: "Car Part Watcher", subjectPrefix: "[Car Part Watcher]" };
for (const args of [[], ["--send"], ["--confirm", "SEND_TEST_EMAIL"], ["--send", "--confirm", "SEND_TEST_EMAIL"]]) {
  Deno.test(`email test does not send without all confirmations: ${args.join(" ") || "none"}`, async () => {
    let calls = 0;
    const result = await runEmailTestCommand(args, settings, async () => { calls++; });
    assertEquals(result.send, false);
    assertEquals(calls, 0);
  });
}
Deno.test("email test sends exactly once with explicit confirmation", async () => {
  const events: string[] = [];
  const result = await runEmailTestCommand(["--send", "--confirm", "SEND_TEST_EMAIL", "--allow-production", "--test-id", "incident-1"], settings, async (event) => { events.push(event.eventId); });
  assertEquals(result.send, true);
  assertEquals(events, ["email-test-incident-1"]);
});
