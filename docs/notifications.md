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

## Gmail SMTP delivery

Gmail delivery extends the same durable outbox; it does not change
reconciliation. The singleton `email_notification_settings` row holds the
enabled flag, recipient, sender display name, subject prefix, and persisted
application URL. `GMAIL_USERNAME` and `GMAIL_APP_PASSWORD` are environment-only
Deno Deploy secrets and are never stored in PostgreSQL.

When enabled, `GmailNotifier` sends plain text and escaped HTML, including
available photo, quote, and saved-search links. Subjects follow
`[Car Part Watcher] <watch>: New <listing> — <price>` (without the suffix when
price is absent). Configure with `deno task email:configure -- --enable
--use-gmail-address`; `deno task email:test` sends one isolated transport test.
Failed SMTP delivery enters the existing retry/backoff flow, while disabled
email uses `LoggingNotifier`. SMTP is at-least-once around the send/mark-
delivered crash window, mitigated by a deterministic Message-ID.

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
