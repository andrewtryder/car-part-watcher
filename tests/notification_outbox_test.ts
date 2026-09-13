import {
  assertEquals,
  assertExists,
  assertStringIncludes,
  assertThrows,
} from "jsr:@std/assert@1.0.19";
import {
  buildNotificationEventV1,
  LoggingNotifier,
  NotificationPayloadValidationError,
  parseNotificationEventV1,
  processNotificationOutbox,
  type Notifier,
  type NotificationEventV1,
} from "../src/services/notification_service.ts";
import {
  createNewListingEvent,
} from "../src/repositories/notification_repository.ts";
import { createSearchRun } from "../src/repositories/search_run_repository.ts";
import { getDatabase } from "../src/db/database.ts";
import type { NormalizedListing } from "../src/listing_normalizer.ts";

const sampleListing: NormalizedListing = {
  source: "car-part",
  sourceKey: "sample-key-1",
  identityMethod: "seller_stock_part",
  year: "2015",
  makeModel: "Honda Accord",
  part: "Alternator",
  description: "OEM tested alternator",
  grade: "A",
  stockNumber: "STK-100",
  priceDisplay: "$107",
  priceAmount: 107,
  recyclerName: "Metro Auto Salvage",
  recyclerLocation: "Queens, NY",
  raw: {
    year: "2015",
    makeModel: "Honda Accord",
    part: "Alternator",
    stockNumber: "STK-100",
  },
};

Deno.test("canonical event builder constructs complete NotificationEventV1", () => {
  const watch = { id: "w-12345", name: "Accord Alternator Watch" };
  const listingId = "l-67890";

  const event = buildNotificationEventV1({
    watch,
    listing: { id: listingId, listing: sampleListing },
    scheduleSlot: "morning",
  });

  assertEquals(event.version, 1);
  assertEquals(event.eventType, "new_listing");
  assertExists(event.eventId);
  assertEquals(event.watch.id, "w-12345");
  assertEquals(event.watch.name, "Accord Alternator Watch");
  assertEquals(event.listing.id, "l-67890");
  assertEquals(event.listing.title, "2015 Honda Accord Alternator");
  assertEquals(event.listing.price, "$107");
  assertEquals(event.listing.location, "Queens, NY");
  assertEquals(event.listing.stockNumber, "STK-100");
  assertEquals(event.schedule.slot, "morning");
});

Deno.test("LoggingNotifier logs safe formatted fields without undefined", async () => {
  const event = buildNotificationEventV1({
    eventId: "evt-test-1",
    watch: { id: "watch-100", name: "Civic Headlight" },
    listing: { id: "list-200", listing: sampleListing },
    scheduleSlot: "afternoon",
  });

  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));

  try {
    const notifier = new LoggingNotifier();
    await notifier.deliver(event);

    assertEquals(logs.length, 1);
    const output = logs[0];
    assertStringIncludes(output, "eventId=evt-test-1");
    assertStringIncludes(output, "watchId=watch-100");
    assertStringIncludes(output, 'watch="Civic Headlight"');
    assertStringIncludes(output, "listingId=list-200");
    assertStringIncludes(output, 'listing="2015 Honda Accord Alternator"');
    assertStringIncludes(output, "price=$107");
    assertStringIncludes(output, "slot=afternoon");

    // Must never contain undefined
    assertEquals(output.includes("undefined"), false);
  } finally {
    console.log = originalLog;
  }
});

Deno.test("runtime validation accepts valid V1 and rejects malformed payloads", () => {
  const valid = buildNotificationEventV1({
    watch: { id: "w-1", name: "Valid Watch" },
    listing: { id: "l-1", listing: sampleListing },
    scheduleSlot: "evening",
  });

  const parsed = parseNotificationEventV1(valid);
  assertEquals(parsed.version, 1);
  assertEquals(parsed.watch.id, "w-1");

  // Missing version
  assertThrows(
    () => parseNotificationEventV1({ ...valid, version: undefined }),
    NotificationPayloadValidationError,
  );

  // Unsupported version
  assertThrows(
    () => parseNotificationEventV1({ ...valid, version: 2 }),
    NotificationPayloadValidationError,
  );

  // Missing watch object
  assertThrows(
    () => parseNotificationEventV1({ ...valid, watch: undefined }),
    NotificationPayloadValidationError,
  );

  // Missing watch.id
  assertThrows(
    () => parseNotificationEventV1({ ...valid, watch: { name: "Foo" } }),
    NotificationPayloadValidationError,
  );

  // Missing listing object or listing.title
  assertThrows(
    () => parseNotificationEventV1({ ...valid, listing: { id: "l-1" } }),
    NotificationPayloadValidationError,
  );

  // Missing schedule.slot
  assertThrows(
    () => parseNotificationEventV1({ ...valid, schedule: {} }),
    NotificationPayloadValidationError,
  );
});

// Database-backed integration tests (active when env & net permissions are granted)
const hasEnv = (await Deno.permissions.query({ name: "env", variable: "DATABASE_URL" })).state === "granted";
const databaseUrl = hasEnv ? Deno.env.get("DATABASE_URL") : undefined;

if (databaseUrl) {
  Deno.test("integration: invalid payload fails validation and is NOT delivered", async () => {
    const sql = getDatabase();
    const watchId = crypto.randomUUID();
    const searchRunId = crypto.randomUUID();
    const listingId = crypto.randomUUID();
    const eventId = crypto.randomUUID();

    try {
      // Create temporary watch & run records to satisfy FK
      await sql`insert into watches (id,name,year,make_model,part,sort) values (${watchId},'Test Watch','2015','Honda Accord','Alternator','price')`;
      await sql`insert into listings (id,source,source_key,year,make_model,part,first_seen_at,last_seen_at) values (${listingId},'car-part',${listingId},'2015','Honda Accord','Alternator',now(),now())`;
      await sql`insert into search_runs (id,watch_id,status,started_at,run_type) values (${searchRunId},${watchId},'succeeded',now(),'manual')`;

      // Insert malformed payload (missing version, watch, schedule)
      const malformedPayload = { legacy: true, missingContract: "yes" };
      await createNewListingEvent(sql, {
        id: eventId,
        watchId,
        searchRunId,
        listingId,
        payload: malformedPayload,
      });

      let notifierCalled = false;
      const testNotifier: Notifier = {
        deliver: (_event: NotificationEventV1) => {
          notifierCalled = true;
          return Promise.resolve();
        },
      };

      const result = await processNotificationOutbox(testNotifier);
      assertEquals(notifierCalled, false);
      assertEquals(result.failed, 1);

      // Verify the event in DB is marked 'failed' with NOTIFICATION_PAYLOAD_INVALID
      const rows = await sql`select status, last_error_code, processed_at from notification_events where id=${eventId}`;
      assertEquals(rows.length, 1);
      assertEquals(rows[0].status, "failed");
      assertEquals(rows[0].last_error_code, "NOTIFICATION_PAYLOAD_INVALID");
      assertEquals(rows[0].processed_at, null);
    } finally {
      await sql`delete from notification_events where id=${eventId}`;
      await sql`delete from search_runs where id=${searchRunId}`;
      await sql`delete from watches where id=${watchId}`;
      await sql`delete from listings where id=${listingId}`;
    }
  });

  Deno.test("integration: notifier failure is non-fatal and leaves event retryable", async () => {
    const sql = getDatabase();
    const watchId = crypto.randomUUID();
    const searchRunId = crypto.randomUUID();
    const listingId = crypto.randomUUID();
    const eventId = crypto.randomUUID();

    try {
      await sql`insert into watches (id,name,year,make_model,part,sort) values (${watchId},'Test Watch','2015','Honda Accord','Alternator','price')`;
      await sql`insert into listings (id,source,source_key,year,make_model,part,first_seen_at,last_seen_at) values (${listingId},'car-part',${listingId},'2015','Honda Accord','Alternator',now(),now())`;
      await sql`insert into search_runs (id,watch_id,status,started_at,run_type) values (${searchRunId},${watchId},'succeeded',now(),'manual')`;

      const validEvent = buildNotificationEventV1({
        eventId,
        watch: { id: watchId, name: "Test Watch" },
        listing: { id: listingId, listing: sampleListing },
        scheduleSlot: "morning",
      });

      await createNewListingEvent(sql, {
        id: eventId,
        watchId,
        searchRunId,
        listingId,
        payload: validEvent,
      });

      const failingNotifier: Notifier = {
        deliver: (_event: NotificationEventV1) => {
          throw new Error("Simulated network timeout");
        },
      };

      const result = await processNotificationOutbox(failingNotifier);
      assertEquals(result.failed, 1);
      assertEquals(result.delivered, 0);

      // Verify event is retryable ('pending', attempts = 1, NOTIFIER_FAILED)
      const rows = await sql`select status, attempts, last_error_code, processed_at from notification_events where id=${eventId}`;
      assertEquals(rows.length, 1);
      assertEquals(rows[0].status, "pending");
      assertEquals(rows[0].attempts, 1);
      assertEquals(rows[0].last_error_code, "NOTIFIER_FAILED");
      assertEquals(rows[0].processed_at, null);
    } finally {
      await sql`delete from notification_events where id=${eventId}`;
      await sql`delete from search_runs where id=${searchRunId}`;
      await sql`delete from watches where id=${watchId}`;
      await sql`delete from listings where id=${listingId}`;
    }
  });

  Deno.test("integration: duplicate event insertion is safely deduplicated by database", async () => {
    const sql = getDatabase();
    const watchId = crypto.randomUUID();
    const searchRunId = crypto.randomUUID();
    const listingId = crypto.randomUUID();

    try {
      await sql`insert into watches (id,name,year,make_model,part,sort) values (${watchId},'Test Watch','2015','Honda Accord','Alternator','price')`;
      await sql`insert into listings (id,source,source_key,year,make_model,part,first_seen_at,last_seen_at) values (${listingId},'car-part',${listingId},'2015','Honda Accord','Alternator',now(),now())`;
      await sql`insert into search_runs (id,watch_id,status,started_at,run_type) values (${searchRunId},${watchId},'succeeded',now(),'manual')`;

      const event = buildNotificationEventV1({
        watch: { id: watchId, name: "Test Watch" },
        listing: { id: listingId, listing: sampleListing },
        scheduleSlot: "morning",
      });

      // Insert once
      await createNewListingEvent(sql, {
        id: event.eventId,
        watchId,
        searchRunId,
        listingId,
        payload: event,
      });

      // Insert second time with same (searchRunId, listingId, 'new_listing')
      const duplicateId = crypto.randomUUID();
      await createNewListingEvent(sql, {
        id: duplicateId,
        watchId,
        searchRunId,
        listingId,
        payload: event,
      });

      const rows = await sql`select id from notification_events where search_run_id=${searchRunId} and listing_id=${listingId}`;
      assertEquals(rows.length, 1);
      assertEquals(rows[0].id, event.eventId);
    } finally {
      await sql`delete from notification_events where search_run_id=${searchRunId}`;
      await sql`delete from search_runs where id=${searchRunId}`;
      await sql`delete from watches where id=${watchId}`;
      await sql`delete from listings where id=${listingId}`;
    }
  });

  Deno.test("integration: duplicate schedule slot execution is idempotent", async () => {
    const sql = getDatabase();
    const watchId = crypto.randomUUID();
    const scheduledKey = `watch:${watchId}:2026-09-13:morning`;

    try {
      await sql`insert into watches (id,name,year,make_model,part,sort) values (${watchId},'Scheduled Watch','2015','Honda Accord','Alternator','price')`;

      const firstRun = await createSearchRun(watchId, {
        runType: "scheduled",
        scheduledKey,
      });
      assertExists(firstRun);
      assertEquals(firstRun.status, "running");

      // Second attempt with exact same scheduledKey should return undefined (no duplicate run)
      const secondRun = await createSearchRun(watchId, {
        runType: "scheduled",
        scheduledKey,
      });
      assertEquals(secondRun, undefined);

      const rows = await sql`select id from search_runs where scheduled_key=${scheduledKey}`;
      assertEquals(rows.length, 1);
    } finally {
      await sql`delete from search_runs where scheduled_key=${scheduledKey}`;
      await sql`delete from watches where id=${watchId}`;
    }
  });
}
