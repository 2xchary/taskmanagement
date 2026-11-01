-- OWNER tag: everyone can see which accounts are the owner (the people in app_admins), so a small tag can sit next to the name.
-- It only returns user ids, nothing else. Safe to re-run. Run after 049_gif_banner.sql.
create or replace function public.owner_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select user_id from public.app_admins
$$;
revoke all on function public.owner_ids() from public, anon;
grant execute on function public.owner_ids() to authenticated;
