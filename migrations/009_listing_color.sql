alter table listings add column if not exists color text;
alter table listings add column if not exists paint_code text;
create index if not exists listings_color_idx on listings (color);
