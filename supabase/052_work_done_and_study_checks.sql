-- 2.56: "I did my work" for each work day, and the "Still studying?" check on the count-up timer. Safe to re-run.
-- Run after 051_phantom_pack.sql.
--
--  * tasks.plan_done: the work days (dates) the person ticked "I did my work for the day".
--  * study_flags: a count-up session that ran 5 hours with nobody answering "Still studying?". The time is still saved,
--    and the admin decides: keep it, put the true time, or void it. Only the functions below touch the table.

-- 1) work days -----------------------------------------------------------------------------------------------------
alter table public.tasks add column if not exists plan_done date[] not null default '{}';
alter table public.tasks drop constraint if exists tasks_plan_done_max;
alter table public.tasks add constraint tasks_plan_done_max check (cardinality(plan_done) <= 40);

-- 2) flagged study time ---------------------------------------------------------------------------------------------
create table if not exists public.study_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_ids uuid[] not null default '{}',                 -- the study_sessions rows that were saved
  claimed_minutes int not null check (claimed_minutes between 1 and 720),
  verified_minutes int not null check (verified_minutes >= 0),   -- where the clock stood when it asked "Still studying?"
  status text not null default 'open' check (status in ('open', 'kept', 'adjusted', 'voided')),
  final_minutes int,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
create index if not exists study_flags_open on public.study_flags (status, created_at desc);
alter table public.study_flags enable row level security;    -- no policies: nobody reads or writes it through the API directly

-- the app calls this after it saved time nobody confirmed. It only accepts the caller's own recent sessions.
create or replace function public.flag_study_check(ids uuid[], claimed int, verified int)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); real_ids uuid[]; total int;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select coalesce(array_agg(id), '{}'), coalesce(sum(minutes), 0) into real_ids, total
    from public.study_sessions where id = any (coalesce(ids, '{}')) and user_id = me and created_at > now() - interval '8 days';
  if total < 1 then return; end if;
  if exists (select 1 from public.study_flags where user_id = me and session_ids && real_ids) then return; end if;
  if (select count(*) from public.study_flags where user_id = me and created_at > now() - interval '1 day') >= 5 then return; end if;
  insert into public.study_flags (user_id, session_ids, claimed_minutes, verified_minutes)
  values (me, real_ids, total, greatest(0, least(coalesce(verified, 0), total)));
end $$;
grant execute on function public.flag_study_check(uuid[], int, int) to authenticated;

-- open flags first, then what was settled in the last 30 days
create or replace function public.admin_study_flags()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return coalesce((
    select jsonb_agg(t.j order by t.o, t.c desc) from (
      select jsonb_build_object(
        'id', f.id, 'user_id', f.user_id, 'person', p.display_name, 'username', p.username,
        'claimed_minutes', f.claimed_minutes, 'verified_minutes', f.verified_minutes, 'status', f.status,
        'final_minutes', f.final_minutes, 'created_at', f.created_at, 'resolved_at', f.resolved_at
      ) as j, case when f.status = 'open' then 0 else 1 end as o, f.created_at as c
      from public.study_flags f left join public.profiles p on p.id = f.user_id
      where f.status = 'open' or f.resolved_at > now() - interval '30 days'
      order by case when f.status = 'open' then 0 else 1 end, f.created_at desc
      limit 60
    ) t
  ), '[]'::jsonb);
end $$;
grant execute on function public.admin_study_flags() to authenticated;

-- how = 'keep' (the time stays as saved) | 'adjust' (true_minutes is what it should be) | 'void' (take it all back)
create or replace function public.admin_resolve_study_flag(fid uuid, how text, true_minutes int default null)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.study_flags; remaining int; r record; part int; final int; shown text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into f from public.study_flags where id = fid for update;
  if not found or f.status <> 'open' then raise exception 'That one was already handled'; end if;

  if how = 'keep' then
    final := f.claimed_minutes;
    update public.study_flags set status = 'kept', final_minutes = final, resolved_at = now(), resolved_by = auth.uid() where id = fid;
  elsif how = 'void' or (how = 'adjust' and coalesce(true_minutes, 0) <= 0) then
    delete from public.study_sessions where id = any (f.session_ids);
    final := 0;
    update public.study_flags set status = 'voided', final_minutes = 0, resolved_at = now(), resolved_by = auth.uid() where id = fid;
  elsif how = 'adjust' then
    if true_minutes > f.claimed_minutes then raise exception 'The true time can not be more than what was saved'; end if;
    remaining := true_minutes;
    for r in select s.id, s.minutes from public.study_sessions s where s.id = any (f.session_ids) order by s.created_at, s.id loop
      part := least(r.minutes, remaining);
      if part <= 0 then delete from public.study_sessions where id = r.id;
      else update public.study_sessions set minutes = part where id = r.id; end if;
      remaining := remaining - part;
    end loop;
    final := true_minutes;
    update public.study_flags set status = 'adjusted', final_minutes = final, resolved_at = now(), resolved_by = auth.uid() where id = fid;
  else
    raise exception 'Unknown choice';
  end if;
  shown := case how when 'keep' then 'kept ' || f.claimed_minutes || ' min' when 'void' then 'voided ' || f.claimed_minutes || ' min' else f.claimed_minutes || ' min changed to ' || final end;
  perform public.admin_note('study check', f.user_id, shown);
end $$;
grant execute on function public.admin_resolve_study_flag(uuid, text, int) to authenticated;
