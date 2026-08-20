-- ============================================================
-- LoveTrack — Migration 0002: per-user reminder time
-- ============================================================
-- The daily "you haven't completed today's activity" reminder used to be a
-- single server-wide time from an environment variable. It is now a
-- per-account setting the user controls from their settings panel.
--
-- Stored as a local wall-clock time, interpreted in the user's own
-- `timezone` column — so 20:30 means 20:30 where they are, not UTC.
-- ============================================================

alter table public.profiles
  add column if not exists reminder_time time not null default '20:30';

comment on column public.profiles.reminder_time is
  'Local time of day for the daily activity reminder, interpreted in profiles.timezone.';

-- The reminder cron scans for users whose local time has just passed their
-- chosen reminder time, so it filters on this column every run.
create index if not exists profiles_reminder_time_idx
  on public.profiles (reminder_time)
  where notify_reminder = true;
