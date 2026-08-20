-- ============================================================
-- LoveTrack — Migration 0020: lock down the service-role-only functions
-- ============================================================
-- `revoke all ... from public` was not enough.
--
-- Supabase grants EXECUTE on functions in the public schema to the `anon`
-- and `authenticated` roles through default privileges. Revoking from
-- PUBLIC removes the pseudo-role grant and leaves those two untouched, so
-- both of these stayed reachable with the anon key — which ships in the
-- client bundle and is therefore held by anyone who has loaded the site.
--
-- What that meant in practice:
--
--   users_due_for_reminder() is SECURITY DEFINER and filters on nothing but
--   "is this person due a reminder". It returns email, full name and
--   timezone. Anyone could have called it and harvested the address of
--   every active user with an unfinished day. It happened to return zero
--   rows when it was found, because nobody was due at that moment — the
--   leak was real, just briefly empty.
--
--   check_rate_limit() could be called directly to inflate arbitrary
--   buckets, which is both a way to grow the table without bound and a way
--   to lock somebody out if their bucket name were ever guessable.
--
-- Neither is ever called from a browser. Both are invoked from server
-- actions and the cron route, which use the service role.
--
-- The other SECURITY DEFINER functions were audited at the same time and
-- are fine: every one of them filters on auth.uid() or is_admin(), so an
-- anonymous caller gets nothing back.
-- ============================================================

revoke execute on function public.users_due_for_reminder() from anon, authenticated;
revoke execute on function public.check_rate_limit(text, integer, integer) from anon, authenticated;

-- Belt and braces: revoke from PUBLIC too, in case a future default
-- privilege re-grants it there.
revoke execute on function public.users_due_for_reminder() from public;
revoke execute on function public.check_rate_limit(text, integer, integer) from public;

comment on function public.users_due_for_reminder is
  'Service role only. Returns personal data with no per-caller filter, so it must never be reachable with the anon key.';
comment on function public.check_rate_limit is
  'Service role only. A caller who can reach this can inflate any bucket.';
