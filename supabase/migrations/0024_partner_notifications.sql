-- ============================================================
-- LoveTrack — Migration 0024: telling the partner
-- ============================================================
-- The notify_check_in / notify_lunch / notify_check_out / notify_leave
-- switches have existed since 0001 and, until now, controlled nothing:
-- leave sent a confirmation to the person who recorded it, and attendance
-- sent nothing at all. Nobody was ever told about anybody else's day, which
-- is the one thing this app exists to do.
--
-- They now mean "email me when someone I am paired with does this". The
-- switch belongs to the RECIPIENT — you decide what lands in your inbox, not
-- what leaves someone else's.
--
-- Two gates, both required:
--
--   1. The actor shares that category with you. Without this, email would be
--      a way around the sharing switches: turn off attendance sharing and
--      still get an email every morning saying they arrived.
--
--   2. You asked for that kind of mail.
--
-- What the email may say is settled elsewhere, in the templates: the fact
-- something happened and when, never where. A location quoted into an inbox
-- has left the permission model behind.
-- ============================================================

create or replace function public.partners_to_notify(
  p_actor_id uuid,
  -- Which sharing switch has to be on: 'attendance' or 'leave'.
  p_permission text,
  -- Which of the recipient's notification switches has to be on.
  p_kind text
)
returns table (
  partner_id uuid,
  email text,
  full_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    other.id,
    other.email,
    other.full_name
  from public.pairs pr
  join public.profiles other
    on other.id = case
                    when pr.requester_id = p_actor_id then pr.receiver_id
                    else pr.requester_id
                  end
  where
    -- Only ever about yourself. Without this the function is a way to read
    -- the email addresses of anybody else's partners.
    p_actor_id = auth.uid()
    and pr.status = 'accepted'
    and (pr.requester_id = p_actor_id or pr.receiver_id = p_actor_id)
    and other.status = 'active'
    -- Gate 1: the actor shares this category with that partner.
    and public.can_view_shared(p_actor_id, p_permission, other.id)
    -- Gate 2: the recipient wants this kind of mail.
    and case p_kind
          when 'check_in'  then other.notify_check_in
          when 'lunch'     then other.notify_lunch
          when 'check_out' then other.notify_check_out
          when 'leave'     then other.notify_leave
          else false
        end;
$$;

revoke all on function public.partners_to_notify(uuid, text, text) from public;
grant execute on function public.partners_to_notify(uuid, text, text) to authenticated;

comment on function public.partners_to_notify is
  'Who should be emailed about one of this user''s events. Requires both that the actor shares the category and that the recipient asked for that kind of mail. Scoped to auth.uid() so it cannot be used to read other people''s partner lists.';
