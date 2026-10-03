# Notifications

Notifications separate three concerns:

- `notification_events` records immutable `new_listing` and `listing_updated`
  facts during reconciliation.
- `notification_inbox_state` records operator read/unread state.
- `notification_deliveries` records channel transport state, attempts, retry
  availability, processing timestamps, and errors.

Events and inbox state are written atomically with reconciliation and run
completion. After a baseline, facts create event/inbox rows regardless of email
policy; `notifyNewListings` and `notifyUpdatedListings` control only email
delivery creation. `notifyOnInitialRun=false` makes a first successful baseline
create none of these records.

## Delivery

Workers claim pending deliveries in small batches using
`FOR UPDATE SKIP LOCKED`. A delivery progresses from pending to processing, then
returns to pending with backoff or becomes delivered/terminally failed. Delivery
activity never changes `read_at`; marking inbox events read never changes
delivery state.

`LoggingNotifier` is the default transport. When enabled, `GmailNotifier` sends
multipart plaintext and escaped HTML via Gmail SMTP. Credentials are
environment-only; recipient and sender settings are persisted.
`deno task
email:test` is dry-run by default and requires explicit confirmation
to send; it never creates notification state or runs a search.

Historical rollout verification is in
[history/production-verification.md](history/production-verification.md).
