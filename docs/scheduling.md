# Scheduling

The application timezone is `APP_TIMEZONE`, defaulting to `America/New_York`.
Watches opt into scheduling with a frequency of one, two, or three runs daily:
morning (08:00), morning/evening (08:00/20:00), or all three windows (08:00,
14:00, 20:00). Windows are evaluated in the IANA timezone, not a fixed UTC
offset; Deno Cron's hourly UTC dispatcher maps into those local windows.

One application-level cron registration dispatches watches sequentially
(concurrency one). Each scheduled attempt has a unique
`watch:<id>:<local-date>:<slot>` key in `search_runs`, so duplicate cron
delivery cannot run a watch twice. Only enabled, schedule-enabled watches are
selected. Disabled watches remain manually runnable but are never scheduled.

## Production verification — 2026-09-13

Production revision `qq3bc297t2fn` has cron support enabled and imports the
hourly watch dispatcher plus the 15-minute notification-outbox drain. The real
`Accord Alternator` watch is enabled at twice daily in
`America/New_York`, leaving the next natural scheduled execution pending. No
schedule window was forced during verification.

The intentionally active real-use watch `CRV Front Bumper`
(`14337db6-b793-4228-804e-dacd52baeb5d`) was added through the production React
console on 2026-09-13. It is enabled at three times daily in
`America/New_York`, corresponding to the 08:00, 14:00, and 20:00 local windows.
No scheduled window was forced; scheduled-run verification remains pending its
next natural execution.
