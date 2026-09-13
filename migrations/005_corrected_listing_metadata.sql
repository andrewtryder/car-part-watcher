alter table listings add column if not exists damage_code text;
alter table listings add column if not exists image_url text;
alter table listings add column if not exists photo_url text;
alter table listings add column if not exists quote_url text;
alter table listings add column if not exists superseded_at timestamptz;
alter table listings add column if not exists superseded_reason text;
