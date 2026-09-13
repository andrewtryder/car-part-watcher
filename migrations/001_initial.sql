create table if not exists source_catalogs (
  source text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null,
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists watches (
  id uuid primary key,
  name text not null,
  enabled boolean not null default true,
  source text not null default 'car-part',
  year text not null,
  make_model text not null,
  part text not null,
  location text,
  sort text not null,
  postal_code text,
  refinement_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
