-- ============================================================
-- LoveTrack — Migration 0004: reading a pair partner's identity
-- ============================================================
-- `profiles` RLS only lets a user read their own row. That is the right
-- default, but it also meant the partner page could not show who the other
-- person in a pair actually is.
--
-- Rather than widen the profiles policy — which would expose every column,
-- including role, status and notification settings — this returns just the
-- four fields the UI needs, and only for people the caller genuinely shares
-- a pending or accepted pair with.
-- ============================================================

create or replace function public.get_pair_partners()
returns table (
  pair_id uuid,
  partner_id uuid,
  full_name text,
  email text,
  avatar_url text
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
    other.avatar_url
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
  'Minimal identity of each pair counterpart. SECURITY DEFINER so it can read profiles, but scoped to the caller''s own pairs.';
