create table if not exists listings (
  id uuid primary key,
  source text not null,
  source_key text not null,
  identity_method text,
  seller_user_id text, part_source_id text, part_guid text, vehicle_guid text, stock_number text,
  year text, make_model text, part text, description text, grade text,
  price_amount numeric, price_currency text, price_display text,
  recycler_name text, recycler_location text, recycler_phone text,
  first_seen_at timestamptz not null, last_seen_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (source, source_key)
);

create table if not exists search_runs (
  id uuid primary key,
  watch_id uuid not null references watches(id) on delete cascade,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null, completed_at timestamptz,
  listing_count integer, new_listing_count integer, changed_count integer,
  pages_fetched integer, error_code text, error_message text,
  created_at timestamptz not null default now()
);

create table if not exists watch_listings (
  watch_id uuid not null references watches(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete restrict,
  first_seen_at timestamptz not null, last_seen_at timestamptz not null,
  first_search_run_id uuid references search_runs(id) on delete set null,
  last_search_run_id uuid references search_runs(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (watch_id, listing_id)
);

create index if not exists watch_listings_watch_last_seen_idx on watch_listings (watch_id, last_seen_at desc);
create index if not exists search_runs_watch_started_idx on search_runs (watch_id, started_at desc);
