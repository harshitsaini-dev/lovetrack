-- ============================================================
-- LoveTrack — Migration 0005: fix the pairs UPDATE policy
-- ============================================================
-- Migration 0003 pinned requester_id/receiver_id inside the policy's
-- WITH CHECK clause with a correlated subquery:
--
--   requester_id = (select p.requester_id from public.pairs p where p.id = id)
--
-- That subquery is evaluated as the calling user, so it only sees pairs
-- they belong to. With a single pair it returns one row and everything
-- looks fine — which is why this survived the first round of testing.
--
-- The moment the same two people have a second pair row, it returns two,
-- and Postgres raises 21000 "more than one row returned by a subquery used
-- as an expression". A second row appears after any unpair-and-repair, so
-- in practice: you could pair once, and never again.
--
-- Reproduced before writing this migration:
--   accept #1 -> 200
--   revoke, request again
--   accept #2 -> 500  21000
--
-- Immutability of the two members is a table invariant, not a permission
-- question, so it belongs in a trigger. That leaves the policy to answer
-- only "who may move this row to which status" — no subquery needed.
-- ============================================================

-- ---------- the two people in a pair can never change ----------

create or replace function public.enforce_pair_members_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.requester_id <> old.requester_id
     or new.receiver_id <> old.receiver_id then
    raise exception 'The members of a pair cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists pairs_members_immutable on public.pairs;
create trigger pairs_members_immutable
  before update on public.pairs
  for each row
  execute function public.enforce_pair_members_immutable();

-- ---------- policy ----------

drop policy if exists pairs_update_member on public.pairs;
create policy pairs_update_member
  on public.pairs
  for update
  to authenticated
  using (
    -- Only live pairs can be touched at all. Rejected and revoked rows are
    -- history: nobody gets to resurrect them.
    status in ('pending', 'accepted')
    and (requester_id = auth.uid() or receiver_id = auth.uid())
  )
  with check (
    -- Only the receiver may answer an invite...
    (status in ('accepted', 'rejected') and receiver_id = auth.uid())
    -- ...but either side may end things, at any time.
    or (
      status = 'revoked'
      and (requester_id = auth.uid() or receiver_id = auth.uid())
    )
  );
