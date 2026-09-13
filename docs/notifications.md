# Notifications

The durable PostgreSQL outbox contains `new_listing` events only. Events are
created only after reconciliation has committed, so notifier failures cannot
roll back listing state or make inventory new again. The first successful run
suppresses events by default (`notify_on_initial_run=false`); later genuinely
new watch/listing relationships create one event per listing and search run.

`LoggingNotifier` is the sole notifier in this phase. It logs a compact safe
summary and marks an event delivered. The processor claims a small batch with
`FOR UPDATE SKIP LOCKED`, retries failures up to three times with backoff, and
is invoked after successful runs plus by a 15-minute Deno Cron drain. No email,
SMS, webhook, or third-party provider is configured.

## Production verification — 2026-09-13

The first successful run of the real `Accord Alternator` watch had 177
new-for-watch listings while `notify_on_initial_run` was false. Its watch-
filtered New Parts view and notification query contained zero events, confirming
baseline suppression. The immediate repeat had zero new listings and still no
events. Read-state mutation was not exercised in production because no natural
new inventory appeared; automated coverage remains the verification for that
path.

The real-use `CRV Front Bumper` watch
(`14337db6-b793-4228-804e-dacd52baeb5d`) also confirmed this behavior on
2026-09-13. Its baseline reconciled 41 listings as new-for-watch with zero
events, because `notify_on_initial_run` is false. The immediate repeat returned
the same 41 listings with zero new listings and still zero events. Its
watch-filtered New Parts view displayed “No unread parts.” The next natural
acceptance event is a genuinely new matching listing, which should create one
unread `new_listing` event and then be processed by `LoggingNotifier`.

## Corrected-history cutover — 2026-09-13

The corrected parser/identity deployment intentionally reset derived result
history while preserving watches and catalogs. The CR-V fresh baseline had 272
new-for-watch relationships and zero events because `notify_on_initial_run`
remained false. Its subsequent 272-listing repeat had zero new relationships
and zero events. `LoggingNotifier` remains the delivery implementation; no
synthetic production event was created merely to exercise delivery metadata.
