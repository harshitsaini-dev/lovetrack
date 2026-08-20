-- ============================================================
-- LoveTrack — Migration 0012: leave requests and email logging
-- ============================================================
-- Leave is different in kind from attendance. Attendance is *verified* —
-- camera, location, server clock, a risk score. Leave is *declared*: the
-- user says they are not working today and gives a reason. There is nothing
-- to verify, so this table has an ordinary INSERT policy rather than going
-- through a SECURITY DEFINER function.
--
-- What still matters is that a reason is mandatory, that a day cannot be
-- both worked and taken off, and that nobody can approve their own leave.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'leave_type') then
    create type public.leave_type as enum
      ('casual', 'sick', 'personal', 'holiday');
  end if;

  if not exists (select 1 from pg_type where typname = 'leave_status') then
    create type public.leave_status as enum
      ('pending', 'approved', 'rejected', 'cancelled');
  end if;
end
$$;

alter table public.system_settings
  -- When false, leave is simply recorded and counts immediately. When true,
  -- an admin has to approve it. Off by default: for two people tracking
  -- each other, an approval queue is ceremony without purpose.
  add column if not exists require_leave_approval boolean not null default false;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  leave_date date not null,
  leave_type public.leave_type not null default 'casual',
  reason text not null,
  status public.leave_status not null default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,

  -- The whole point of asking for a reason is that it says something.
  constraint leave_reason_not_empty check (length(trim(reason)) >= 3),
  constraint leave_reason_length check (length(reason) <= 500)
);

-- One live request per day. A cancelled or rejected one leaves the day free
-- to be requested again.
create unique index if not exists leave_one_active_per_day_idx
  on public.leave_requests (user_id, leave_date)
  where status in ('pending', 'approved');

create index if not exists leave_user_date_idx
  on public.leave_requests (user_id, leave_date desc);
create index if not exists leave_status_idx
  on public.leave_requests (status)
  where status = 'pending';

drop trigger if exists leave_requests_set_updated_at on public.leave_requests;
create trigger leave_requests_set_updated_at
  before update on public.leave_requests
  for each row
  execute function public.set_updated_at();

-- ---------- a day cannot be both worked and taken off ----------

create or replace function public.enforce_leave_not_worked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('pending', 'approved')
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

drop trigger if exists leave_not_worked on public.leave_requests;
create trigger leave_not_worked
  before insert or update on public.leave_requests
  for each row
  execute function public.enforce_leave_not_worked();

-- ---------- RLS ----------

alter table public.leave_requests enable row level security;
alter table public.leave_requests force row level security;

drop policy if exists leave_select_own on public.leave_requests;
create policy leave_select_own
  on public.leave_requests for select to authenticated
  using (user_id = auth.uid());

drop policy if exists leave_select_partner on public.leave_requests;
create policy leave_select_partner
  on public.leave_requests for select to authenticated
  using (public.can_view_shared(user_id, 'leave'));

drop policy if exists leave_select_admin on public.leave_requests;
create policy leave_select_admin
  on public.leave_requests for select to authenticated
  using (public.is_admin());

-- A user files their own leave, and only as pending. Inserting one already
-- approved would be approving your own request.
drop policy if exists leave_insert_own on public.leave_requests;
create policy leave_insert_own
  on public.leave_requests for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

-- Cancelling is the only change a user may make to their own request, and
-- only while it is still pending. Editing the reason after the fact, or
-- reviving a rejected one, is not on the table.
drop policy if exists leave_cancel_own on public.leave_requests;
create policy leave_cancel_own
  on public.leave_requests for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'cancelled');

drop policy if exists leave_review_admin on public.leave_requests;
create policy leave_review_admin
  on public.leave_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- Email log
-- ============================================================
-- Two jobs: a record of what was sent, and the thing that stops a cron
-- retry from emailing somebody the same reminder twice.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'email_status') then
    create type public.email_status as enum ('sent', 'failed', 'skipped');
  end if;
end
$$;

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  template text not null,
  to_email text not null,
  subject text,
  status public.email_status not null,
  provider_id text,
  error text,

  -- What makes this send unique. For a daily reminder it is the date, so a
  -- second attempt on the same day collides instead of sending again.
  dedup_key text,

  created_at timestamptz not null default now()
);

create unique index if not exists email_logs_dedup_idx
  on public.email_logs (user_id, template, dedup_key)
  where dedup_key is not null and status = 'sent';

create index if not exists email_logs_created_idx
  on public.email_logs (created_at desc);
create index if not exists email_logs_user_idx
  on public.email_logs (user_id, created_at desc);

alter table public.email_logs enable row level security;
alter table public.email_logs force row level security;

-- A user can see what was sent to them; only an admin sees everything.
-- Nothing writes here from a client — sending happens server-side.
drop policy if exists email_logs_select_own on public.email_logs;
create policy email_logs_select_own
  on public.email_logs for select to authenticated
  using (user_id = auth.uid());

drop policy if exists email_logs_select_admin on public.email_logs;
create policy email_logs_select_admin
  on public.email_logs for select to authenticated
  using (public.is_admin());

-- ============================================================
-- Who is due a reminder
-- ============================================================
-- Called by the cron. Returns users whose local reminder time has just
-- passed, who have not finished the day, and who are not on leave.

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
    -- Their own reminder time, in their own timezone, has passed today.
    and (now() at time zone p.timezone)::time >= p.reminder_time
    -- Nothing to nag about if the day is already closed.
    and coalesce(a.status, 'not_started') <> 'checked_out'
    -- Nor if they told us they are off today.
    and not exists (
      select 1 from public.leave_requests l
      where l.user_id = p.id
        and l.leave_date = (now() at time zone p.timezone)::date
        and l.status in ('pending', 'approved')
    )
    -- And not if we already sent it today.
    and not exists (
      select 1 from public.email_logs e
      where e.user_id = p.id
        and e.template = 'daily_reminder'
        and e.status = 'sent'
        and e.dedup_key = ((now() at time zone p.timezone)::date)::text
    );
$$;

revoke all on function public.users_due_for_reminder() from public;
