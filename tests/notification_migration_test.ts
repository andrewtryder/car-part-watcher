import { assertEquals, assertExists } from "jsr:@std/assert@1.0.19";
import postgres from "npm:postgres@3.4.7";

const permitted = (await Deno.permissions.query({
  name: "env",
  variable: "LEGACY_DATABASE_URL",
})).state === "granted";
const url = permitted ? Deno.env.get("LEGACY_DATABASE_URL") : undefined;
const sql = url ? postgres(url, { max: 1 }) : undefined;

Deno.test(
  "legacy notification state backfills into event, inbox, and delivery tables",
  { ignore: !sql },
  async () => {
    if (!sql) return;
    const files = [
      "001_initial.sql",
      "002_listing_reconciliation.sql",
      "003_scheduling_notification_outbox.sql",
      "004_notification_read_state.sql",
      "005_corrected_listing_metadata.sql",
      "006_email_notification_settings.sql",
      "007_listing_change_tracking.sql",
    ];
    for (const file of files) {
      await sql.unsafe(await Deno.readTextFile(`migrations/${file}`));
    }
    const watchId = crypto.randomUUID(),
      runId = crypto.randomUUID(),
      listingId = crypto.randomUUID();
    const pendingId = crypto.randomUUID(), readFailedId = crypto.randomUUID();
    await sql`insert into watches (id,name,year,make_model,part,sort) values (${watchId},'Migration Watch','2015','Honda Accord','Alternator','price')`;
    await sql`insert into listings (id,source,source_key,year,make_model,part,first_seen_at,last_seen_at) values (${listingId},'car-part',${listingId},'2015','Honda Accord','Alternator',now(),now())`;
    await sql`insert into search_runs (id,watch_id,status,started_at,run_type) values (${runId},${watchId},'succeeded',now(),'manual')`;
    await sql`insert into notification_events (id,watch_id,search_run_id,listing_id,event_type,payload,status,attempts,available_at) values (${pendingId},${watchId},${runId},${listingId},'new_listing','{}','pending',2,now() + interval '5 minutes')`;
    await sql`insert into notification_events (id,watch_id,search_run_id,listing_id,event_type,payload,status,attempts,available_at,processed_at,read_at,last_error_code,last_error_message) values (${readFailedId},${watchId},${runId},null,'listing_updated','{}','failed',3,now() - interval '1 minute',now(),now(),'SMTP_FAILED','mailbox rejected')`;
    await sql.unsafe(
      await Deno.readTextFile("migrations/008_notification_event_state.sql"),
    );
    const pending =
      await sql`select i.read_at,d.status,d.attempts,d.available_at from notification_events e join notification_inbox_state i on i.event_id=e.id join notification_deliveries d on d.event_id=e.id where e.id=${pendingId}`;
    const failed =
      await sql`select i.read_at,d.status,d.attempts,d.processed_at,d.last_error_code,d.last_error_message from notification_events e join notification_inbox_state i on i.event_id=e.id join notification_deliveries d on d.event_id=e.id where e.id=${readFailedId}`;
    assertEquals(pending.length, 1);
    assertEquals(pending[0].read_at, null);
    assertEquals(pending[0].status, "pending");
    assertEquals(pending[0].attempts, 2);
    assertExists(pending[0].available_at);
    assertEquals(failed.length, 1);
    assertExists(failed[0].read_at);
    assertEquals(failed[0].status, "failed");
    assertEquals(failed[0].attempts, 3);
    assertExists(failed[0].processed_at);
    assertEquals(failed[0].last_error_code, "SMTP_FAILED");
    assertEquals(failed[0].last_error_message, "mailbox rejected");
    await sql.end();
  },
);
