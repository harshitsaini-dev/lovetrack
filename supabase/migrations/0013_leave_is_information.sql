-- ============================================================
-- LoveTrack — Migration 0013: leave is information, not a request
-- ============================================================
-- Migration 0012 modelled leave as something an admin approves: pending,
-- approved, rejected, plus reviewer columns and a settings flag.
--
-- That was the wrong shape. LoveTrack is two people keeping each other in
-- the loop, not an HR system. Saying "I'm off today" is a statement, not a
-- petition — there is nobody whose permission is required, and an approval
-- queue would only add a step that always ends in yes.
--
-- So leave is now simply recorded, and can be withdrawn if it was entered
-- by mistake. Two states, no reviewer.
-- ============================================================

-- ---------- drop everything that assumed approval ----------

drop policy if exists leave_insert_own on public.leave_requests;
drop policy if exists leave_cancel_own on public.leave_requests;
drop policy if exists leave_review_admin on public.leave_requests;
drop index if exists public.leave_one_active_per_day_idx;
drop index if exists public.leave_status_idx;

alter table public.leave_requests
  drop column if exists reviewed_by,
  drop column if exists reviewed_at,
  drop column if exists review_note;

alter table public.system_settings
  drop column if exists require_leave_approval;

-- ---------- two states ----------

alter table public.leave_requests alter column status drop default;
alter table public.leave_requests alter column status type text using status::text;

update public.leave_requests
set status = case when status = 'cancelled' then 'cancelled' else 'recorded' end;

drop type if exists public.leave_status;
create type public.leave_status as enum ('recorded', 'cancelled');

alter table public.leave_requests
  alter column status type public.leave_status using status::public.leave_status;
alter table public.leave_requests
  alter column status set default 'recorded';

-- One live entry per day; a withdrawn one frees the day up again.
create unique index if not exists leave_one_active_per_day_idx
  on public.leave_requests (user_id, leave_date)
  where status = 'recorded';

-- ---------- policies ----------

create policy leave_insert_own
  on public.leave_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'recorded');

-- Withdrawing is the only change anyone can make. The reason cannot be
-- edited afterwards and a withdrawn entry cannot be revived — otherwise
-- "what I said on the day" would be rewritable after the fact.
create policy leave_withdraw_own
  on public.leave_requests for update to authenticated
  using (user_id = auth.uid() and status = 'recorded')
  with check (user_id = auth.uid() and status = 'cancelled');

-- No admin review policy: there is nothing to review.

-- ---------- the reminder query follows suit ----------

create or replace function public.users_due_for_reminder()
returns table (
  user_id uuid,
  email text,
  full_name text,
  timezone text,
  local_date date,
  attendance_status public.attendance_status
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.email,
    p.full_name,
    p.timezone,
    (now() at time zone p.timezone)::date as local_date,
    coalesce(a.status, 'not_started'::public.attendance_status)
  from public.profiles p
  left join public.attendance a
    on a.user_id = p.id
   and a.attendance_date = (now() at time zone p.timezone)::date
  where p.status = 'active'
    and p.notify_reminder
    and (now() at time zone p.timezone)::time >= p.reminder_time
    and coalesce(a.status, 'not_started') <> 'checked_out'
    -- Nothing to nag about if they said they are off today.
    and not exists (
      select 1 from public.leave_requests l
      where l.user_id = p.id
        and l.leave_date = (now() at time zone p.timezone)::date
        and l.status = 'recorded'
    )
    and not exists (
      select 1 from public.email_logs e
      where e.user_id = p.id
        and e.template = 'daily_reminder'
        and e.status = 'sent'
        and e.dedup_key = ((now() at time zone p.timezone)::date)::text
    );
$$;

revoke all on function public.users_due_for_reminder() from public;

-- ---------- the worked-day guard follows suit ----------

create or replace function public.enforce_leave_not_worked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'recorded'
     and exists (
       select 1 from public.attendance
       where user_id = new.user_id
         and attendance_date = new.leave_date
         and status <> 'not_started'
     ) then
    raise exception 'already_worked_that_day';
  end if;

  return new;
end;
$$;
