-- A new Style pack: Phantom Heist (600 coins). Safe to re-run. Run after 050_owner_tag.sql.
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check
  check (theme in ('default', 'dark', 'gordon', 'stonybrook', 'umaine', 'aero', 'sprout', 'console', 'capsule', 'meadow', 'island', 'arcade', 'lofi', 'shore', 'twilight', 'rose', 'tile', 'handheld', 'golden', 'clay', 'brutal', 'wabi', 'cyber', 'scrap', 'library', 'phantom'));

insert into public.shop_items (id, kind, name, price, sort) values
  ('phantom', 'theme', 'Phantom Heist', 600, 27)
on conflict (id) do update set price = excluded.price, name = excluded.name, sort = excluded.sort;

-- All six Style packs cost 600 coins now (they were 700). Anyone who already owns one keeps it.
update public.shop_items set price = 600 where id in ('clay', 'brutal', 'wabi', 'cyber', 'scrap', 'phantom');
