create table if not exists listing_changes (
  id uuid primary key,
  listing_id uuid not null references listings(id) on delete cascade,
  watch_id uuid references watches(id) on delete cascade,
  search_run_id uuid references search_runs(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index if not exists listing_changes_listing_created_idx on listing_changes (listing_id, created_at desc);
create index if not exists listing_changes_watch_created_idx on listing_changes (watch_id, created_at desc);
create index if not exists listing_changes_run_idx on listing_changes (search_run_id);

alter table notification_events drop constraint if exists notification_events_event_type_check;
alter table notification_events add constraint notification_events_event_type_check check (event_type in ('new_listing', 'listing_updated'));
