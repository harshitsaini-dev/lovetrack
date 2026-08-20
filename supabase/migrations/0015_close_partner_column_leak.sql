-- ============================================================
-- LoveTrack — Migration 0015: close the partner column leak
-- ============================================================
-- Migration 0014 added functions that withhold location from a partner who
-- has attendance shared but not location. It left the underlying row
-- policies in place, on the reasoning that the app reads through the
-- functions.
--
-- That was not good enough. The policies were still there, so a partner
-- could skip the functions entirely and read the table directly with their
-- own token:
--
--   GET /rest/v1/attendance_events?select=latitude,longitude&user_id=eq.<them>
--
-- Anyone who opens devtools could bypass the location switch. A privacy
-- control that only holds while you use the intended screen is not a
-- control at all.
--
-- The fix is to remove the partner's direct read entirely. The functions
-- are SECURITY DEFINER, so they keep working — they were never relying on
-- these policies. What changes is that there is no longer a second route.
--
-- Own rows and admin access are untouched.
-- ============================================================

drop policy if exists attendance_select_partner on public.attendance;
drop policy if exists attendance_events_select_partner on public.attendance_events;

comment on table public.attendance_events is
  'Attendance events. A partner has NO direct read policy here: latitude and longitude sit on the same row as the timestamp, and a row policy cannot grant one without the other. Partner reads go through get_partner_events(), which withholds location unless it is shared.';

-- Lunch proofs are a different case and keep their policy: the whole row is
-- gated by one switch (share_lunch_proof), so there is no field within it
-- that needs separate treatment.
