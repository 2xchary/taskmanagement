-- 2.58: when the admin decides on a "study clock left on?" check, the person is told what happened and the outcome.
-- Run after 052_work_done_and_study_checks.sql. Safe to re-run.
--
--  * notifications gets a new kind, 'study_check'. detail = 'keep|claimed|final' (or 'void|..', 'adjust|..'), minutes as numbers.
--  * admin_resolve_study_flag now also adds that notification for the person; the app shows it as a pop-up and in their mail.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('comment', 'reaction', 'mention_post', 'mention_comment', 'study_check'));

create or replace function public.admin_resolve_study_flag(fid uuid, how text, true_minutes int default null)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.study_flags; remaining int; r record; part int; final int; shown text; outcome text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into f from public.study_flags where id = fid for update;
  if not found or f.status <> 'open' then raise exception 'That one was already handled'; end if;

  if how = 'keep' then
    final := f.claimed_minutes; outcome := 'keep';
    update public.study_flags set status = 'kept', final_minutes = final, resolved_at = now(), resolved_by = auth.uid() where id = fid;
  elsif how = 'void' or (how = 'adjust' and coalesce(true_minutes, 0) <= 0) then
    delete from public.study_sessions where id = any (f.session_ids);
    final := 0; outcome := 'void';
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
    final := true_minutes; outcome := 'adjust';
    update public.study_flags set status = 'adjusted', final_minutes = final, resolved_at = now(), resolved_by = auth.uid() where id = fid;
  else
    raise exception 'Unknown choice';
  end if;
  shown := case how when 'keep' then 'kept ' || f.claimed_minutes || ' min' when 'void' then 'voided ' || f.claimed_minutes || ' min' else f.claimed_minutes || ' min changed to ' || final end;
  perform public.admin_note('study check', f.user_id, shown);
  -- tell the person
  insert into public.notifications (user_id, actor_id, kind, detail)
  values (f.user_id, auth.uid(), 'study_check', outcome || '|' || f.claimed_minutes || '|' || final);
end $$;
grant execute on function public.admin_resolve_study_flag(uuid, text, int) to authenticated;
