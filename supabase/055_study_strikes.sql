-- 2.59: strikes for forgotten study clocks. Forgive first, strikes after. Safe to re-run.
-- Run after 054_study_check_result.sql.
--
--  * When the admin cuts or voids a flagged clock, that is a strike for the person. Strikes last 30 days.
--  * Strikes 1 and 2: the time up to the last check-in plus 5 hours (verified_minutes) is protected. It stays even if the admin voids it.
--    The person is told it is a warning.
--  * Strike 3 and after (inside 30 days): the admin's decision applies in full.
--  * "Keep it" is never a strike.
--  * Strikes are stored on the flag itself (study_flags.strike), so nothing else is needed.

alter table public.study_flags add column if not exists strike int not null default 0;
alter table public.study_flags add column if not exists protected boolean not null default false;

-- the admin list also says how many strikes each person already has (last 30 days)
create or replace function public.admin_study_flags()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return coalesce((
    select jsonb_agg(t.j order by t.o, t.c desc) from (
      select jsonb_build_object(
        'id', f.id, 'user_id', f.user_id, 'person', p.display_name, 'username', p.username,
        'claimed_minutes', f.claimed_minutes, 'verified_minutes', f.verified_minutes, 'status', f.status,
        'final_minutes', f.final_minutes, 'created_at', f.created_at, 'resolved_at', f.resolved_at,
        'strike', f.strike, 'protected', f.protected,
        'strikes', (select count(*) from public.study_flags x
                    where x.user_id = f.user_id and x.strike > 0 and x.id <> f.id and x.resolved_at > now() - interval '30 days')
      ) as j, case when f.status = 'open' then 0 else 1 end as o, f.created_at as c
      from public.study_flags f left join public.profiles p on p.id = f.user_id
      where f.status = 'open' or f.resolved_at > now() - interval '30 days'
      order by case when f.status = 'open' then 0 else 1 end, f.created_at desc
      limit 60
    ) t
  ), '[]'::jsonb);
end $$;
grant execute on function public.admin_study_flags() to authenticated;

create or replace function public.admin_resolve_study_flag(fid uuid, how text, true_minutes int default null)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.study_flags; remaining int; r record; part int; final int; req int; prior int; s int := 0; prot boolean := false; shown text; outcome text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into f from public.study_flags where id = fid for update;
  if not found or f.status <> 'open' then raise exception 'That one was already handled'; end if;

  -- what the admin asked for
  if how = 'keep' then req := f.claimed_minutes;
  elsif how = 'void' or (how = 'adjust' and coalesce(true_minutes, 0) <= 0) then req := 0;
  elsif how = 'adjust' then
    if true_minutes > f.claimed_minutes then raise exception 'The true time can not be more than what was saved'; end if;
    req := true_minutes;
  else raise exception 'Unknown choice';
  end if;

  final := req;
  if req < f.claimed_minutes then
    -- cutting time is a strike. The first two are warnings: the confirmed time stays.
    select count(*) into prior from public.study_flags
      where user_id = f.user_id and strike > 0 and id <> f.id and resolved_at > now() - interval '30 days';
    s := prior + 1;
    if s <= 2 then
      final := least(f.claimed_minutes, greatest(req, f.verified_minutes));
      prot := final > req;
    end if;
  end if;

  -- apply it to the saved sessions
  if final = 0 then
    delete from public.study_sessions where id = any (f.session_ids);
  elsif final < f.claimed_minutes then
    remaining := final;
    for r in select ss.id, ss.minutes from public.study_sessions ss where ss.id = any (f.session_ids) order by ss.created_at, ss.id loop
      part := least(r.minutes, remaining);
      if part <= 0 then delete from public.study_sessions where id = r.id;
      else update public.study_sessions set minutes = part where id = r.id; end if;
      remaining := remaining - part;
    end loop;
  end if;

  outcome := case when final >= f.claimed_minutes then 'keep' when final = 0 then 'void' else 'adjust' end;
  update public.study_flags
    set status = case outcome when 'keep' then 'kept' when 'void' then 'voided' else 'adjusted' end,
        final_minutes = final, resolved_at = now(), resolved_by = auth.uid(), strike = s, protected = prot
    where id = fid;

  shown := case outcome when 'keep' then 'kept ' || f.claimed_minutes || ' min' when 'void' then 'voided ' || f.claimed_minutes || ' min'
           else f.claimed_minutes || ' min changed to ' || final end
           || case when s > 0 then ', strike ' || s || case when prot then ' (protected ' || final || ' min)' else '' end else '' end;
  perform public.admin_note('study check', f.user_id, shown);

  -- tell the person: outcome | saved | final | strike number | protected (1/0) | what the admin asked for
  insert into public.notifications (user_id, actor_id, kind, detail)
  values (f.user_id, auth.uid(), 'study_check', outcome || '|' || f.claimed_minutes || '|' || final || '|' || s || '|' || (case when prot then 1 else 0 end) || '|' || req);
end $$;
grant execute on function public.admin_resolve_study_flag(uuid, text, int) to authenticated;
