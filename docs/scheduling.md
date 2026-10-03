# Scheduling

`APP_TIMEZONE` defaults to `America/New_York`. Watches may run once daily
(08:00), twice daily (08:00/20:00), or three times daily (08:00/14:00/20:00) in
that IANA timezone. Deno Cron's hourly UTC dispatcher maps each evaluation to
those local windows.

One application-level dispatcher selects enabled, schedule-enabled watches and
runs them sequentially. Each attempt has a unique
`watch:<id>:<local-date>:<slot>` search-run key, so duplicate cron delivery
cannot execute a watch twice. Disabled watches remain manually runnable.

The notification delivery drain has its own periodic cron schedule. Cron imports
application services directly rather than invoking HTTP routes, so console
credentials do not affect scheduled execution.
