create table if not exists email_notification_settings (
  id text primary key,
  enabled boolean not null default false,
  to_address text,
  from_name text not null default 'Car Part Watcher',
  subject_prefix text not null default '[Car Part Watcher]',
  app_base_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = 'default')
);

insert into email_notification_settings (id)
values ('default') on conflict (id) do nothing;
