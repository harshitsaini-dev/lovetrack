-- ============================================================
-- LoveTrack — Migration 0023: separate check-in and check-out reminders,
-- set by the partner
-- ============================================================
-- Two changes to the daily nudge.
--
-- 1. ONE TIME BECOMES TWO.
--
--    A single reminder_time could only ever nag about the whole day at once,
--    which meant it had to be set late enough to be after check-out — and by
--    then a missed check-in has already cost the whole morning. Splitting it
--    lets the check-in reminder fire in the morning and the check-out one in
--    the evening, each about the thing that is actually outstanding.
--
-- 2. THE PARTNER SETS THEM.
--
--    This is the point of the app: you want to know when your friend starts
--    and finishes, so you are the one who knows when they should be nudged.
--
--    It is also a transfer of control over somebody else's inbox, so it is
--    built to stay visible rather than silent: the owner can still change
--    their own times, and reminder_set_by records who set them last so the
--    settings screen can say "Priya set this" instead of leaving a person
--    wondering why their phone buzzed at 09:00.
-- ============================================================

alter table public.profiles
  add column if not exists check_in_reminder_time time not null default '10:00',
  add column if not exists check_out_reminder_time time not null default '20:30',
  add column if not exists reminder_set_by uuid references public.profiles (id) on delete set null;

comment on column public.profiles.check_in_reminder_time is
  'Local time after which a missing check-in is chased, interpreted in profiles.timezone.';
comment on column public.profiles.check_out_reminder_time is
  'Local time after which an unfinished day is chased, interpreted in profiles.timezone.';
comment on column public.profiles.reminder_set_by is
  'Who last set these times. Null means the owner did. Shown in settings so a partner-set schedule is never a mystery.';

-- Carry the old value forward rather than resetting everyone to the default.
-- The single reminder_time was in practice an end-of-day nudge, so that is
-- where it belongs.
update public.profiles
set check_out_reminder_time = reminder_time
where reminder_time is not null;

drop index if exists profiles_reminder_time_idx;

alter table public.profiles drop column if exists reminder_time;

create index if not exists profiles_reminder_times_idx
  on public.profiles (check_in_reminder_time, check_out_reminder_time)
  where notify_reminder = true;

-- ---------- who may set them ----------
-- The owner, or anyone they have an accepted pairing with. Deliberately not
-- gated on a sharing switch: those control what you can SEE, and this is
-- about looking out for each other rather than about visibility.

create or replace function public.set_reminder_times(
  p_user_id uuid,
  p_check_in time,
  p_check_out time
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_target public.profiles;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_check_in is null or p_check_out is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_time');
  end if;

  select * into v_target from public.profiles where id = p_user_id;

  if v_target.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_me <> p_user_id and not public.is_paired_with(p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'not_paired');
  end if;

  update public.profiles
  set check_in_reminder_time = p_check_in,
      check_out_reminder_time = p_check_out,
      -- Null when you set your own, so "who changed this" reads correctly
      -- rather than pointing at yourself.
      reminder_set_by = case when v_me = p_user_id then null else v_me end
  where id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.set_reminder_times(uuid, time, time) from public;
grant execute on function public.set_reminder_times(uuid, time, time) to authenticated;

-- ---------- the cron asks a different question now ----------
-- Previously: "is anything outstanding, and has their one time passed?"
-- Now each kind is asked separately, because they are due at different
-- moments and are about different things.
--
-- Returned as one set with a `reminder_kind` column rather than two
-- functions, so the route keeps making a single call and cannot end up
-- sending one kind and forgetting the other.

drop function if exists public.users_due_for_reminder();

create function public.users_due_for_reminder()
returns table (
  user_id uuid,
  email text,
  full_name text,
  timezone text,
  local_date date,
  attendance_status public.attendance_status,
  reminder_kind text
)
language sql
stable
security definer
set search_path = public
as $$
  with candidates as (
    select
      p.id,
      p.email,
      p.full_name,
      p.timezone,
      (now() at time zone p.timezone)::date as local_date,
      (now() at time zone p.timezone)::time as local_time,
      p.check_in_reminder_time,
      p.check_out_reminder_time,
      coalesce(a.status, 'not_started'::public.attendance_status) as status
    from public.profiles p
    left join public.attendance a
      on a.user_id = p.id
     and a.attendance_date = (now() at time zone p.timezone)::date
    where p.status = 'active'
      and p.notify_reminder
      -- Nothing to chase if they told us they are off today.
      and not exists (
        select 1 from public.leave_requests l
        where l.user_id = p.id
          and l.leave_date = (now() at time zone p.timezone)::date
          and l.status = 'recorded'
      )
  ),
  due as (
    select
      c.*,
      case
        -- The day has not begun and the morning time has passed.
        when c.status = 'not_started' and c.local_time >= c.check_in_reminder_time
          then 'check_in'
        -- It began but never closed, and the evening time has passed.
        when c.status in ('checked_in', 'lunch_active', 'lunch_verified')
             and c.local_time >= c.check_out_reminder_time
          then 'check_out'
      end as kind
    from candidates c
  )
  select
    d.id, d.email, d.full_name, d.timezone, d.local_date, d.status, d.kind
  from due d
  where d.kind is not null
    -- One of each kind per day. The key carries the kind, so a morning
    -- reminder does not suppress the evening one.
    and not exists (
      select 1 from public.email_logs e
      where e.user_id = d.id
        and e.template = 'daily_reminder'
        and e.status = 'sent'
        and e.dedup_key = d.local_date::text || ':' || d.kind
    );
$$;

-- Service role only. Granting this to authenticated would hand every signed
-- in user a list of active accounts and their email addresses.
revoke all on function public.users_due_for_reminder() from public;
revoke all on function public.users_due_for_reminder() from anon, authenticated;

-- ---------- the partner screen needs the current times to edit them ----------
-- Widened by exactly two columns and no more. The alternative was opening
-- the profiles policy, which would expose role, status and every
-- notification preference to anyone you happen to be paired with.

drop function if exists public.get_pair_partners();

create function public.get_pair_partners()
returns table (
  pair_id uuid,
  partner_id uuid,
  full_name text,
  email text,
  avatar_url text,
  check_in_reminder_time time,
  check_out_reminder_time time
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as pair_id,
    other.id as partner_id,
    other.full_name,
    other.email,
    other.avatar_url,
    other.check_in_reminder_time,
    other.check_out_reminder_time
  from public.pairs p
  join public.profiles other
    on other.id = case
                    when p.requester_id = auth.uid() then p.receiver_id
                    else p.requester_id
                  end
  where p.status in ('pending', 'accepted')
    and (p.requester_id = auth.uid() or p.receiver_id = auth.uid());
$$;

revoke all on function public.get_pair_partners() from public;
grant execute on function public.get_pair_partners() to authenticated;

comment on function public.get_pair_partners is
  'Minimal identity of each pair counterpart, plus their reminder times so a partner can set them. SECURITY DEFINER so it can read profiles, but scoped to the caller''s own pairs.';
