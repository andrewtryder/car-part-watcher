create table if not exists notification_inbox_state (
  event_id uuid primary key references notification_events(id) on delete cascade,
  read_at timestamptz
);

create table if not exists notification_deliveries (
  id uuid primary key,
  event_id uuid not null references notification_events(id) on delete cascade,
  channel text not null check (channel in ('email')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, channel)
);
create index if not exists notification_deliveries_status_available_idx on notification_deliveries (status, available_at);
create index if not exists notification_inbox_state_unread_idx on notification_inbox_state (event_id) where read_at is null;

insert into notification_inbox_state (event_id, read_at)
select id, read_at from notification_events
on conflict (event_id) do nothing;

insert into notification_deliveries (id, event_id, channel, status, attempts, available_at, processed_at, last_error_code, last_error_message, created_at, updated_at)
select id, id, 'email', status, attempts, available_at, processed_at, last_error_code, last_error_message, created_at, updated_at
from notification_events
on conflict (event_id, channel) do nothing;
