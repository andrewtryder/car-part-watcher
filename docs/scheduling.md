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
