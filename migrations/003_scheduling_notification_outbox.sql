alter table watches add column if not exists schedule_enabled boolean not null default false;
alter table watches add column if not exists run_frequency integer not null default 1 check (run_frequency between 1 and 3);
alter table watches add column if not exists notify_on_initial_run boolean not null default false;

alter table search_runs add column if not exists run_type text not null default 'manual' check (run_type in ('manual', 'scheduled'));
alter table search_runs add column if not exists scheduled_key text;
create unique index if not exists search_runs_scheduled_key_idx on search_runs (scheduled_key) where scheduled_key is not null;

create table if not exists notification_events (
  id uuid primary key,
  watch_id uuid not null references watches(id) on delete cascade,
  search_run_id uuid not null references search_runs(id) on delete cascade,
  event_type text not null check (event_type = 'new_listing'),
  listing_id uuid references listings(id) on delete set null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(), processed_at timestamptz,
  last_error_code text, last_error_message text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (search_run_id, listing_id, event_type)
);
create index if not exists notification_events_status_available_idx on notification_events (status, available_at);
create index if not exists notification_events_watch_created_idx on notification_events (watch_id, created_at desc);
