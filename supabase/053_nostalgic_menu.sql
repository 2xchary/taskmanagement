-- A new Style pack: Nostalgic Menu (600 coins). Safe to re-run. Run after 052_work_done_and_study_checks.sql.
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check
  check (theme in ('default', 'dark', 'gordon', 'stonybrook', 'umaine', 'aero', 'sprout', 'console', 'capsule', 'meadow', 'island', 'arcade', 'lofi', 'shore', 'twilight', 'rose', 'tile', 'handheld', 'golden', 'clay', 'brutal', 'wabi', 'cyber', 'scrap', 'library', 'phantom', 'nostalgic'));

insert into public.shop_items (id, kind, name, price, sort) values
  ('nostalgic', 'theme', 'Nostalgic Menu', 600, 28)
on conflict (id) do update set price = excluded.price, name = excluded.name, sort = excluded.sort;
