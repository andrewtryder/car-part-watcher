alter table notification_events add column if not exists read_at timestamptz;
create index if not exists notification_events_unread_idx on notification_events (event_type, created_at desc) where read_at is null;
