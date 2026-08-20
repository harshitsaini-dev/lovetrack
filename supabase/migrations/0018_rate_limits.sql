-- ============================================================
-- LoveTrack — Migration 0018: rate limiting
-- ============================================================
-- There was none. Login, registration, password reset and pairing requests
-- could all be hammered as fast as the network allowed — which turns a
-- weak password into a matter of time, and turns pairing into a way to
-- probe which addresses are registered by watching timing.
--
-- The counter lives in Postgres rather than in memory because the app runs
-- on serverless workers: an in-memory counter would reset on every cold
-- start and be per-instance, which is a limit an attacker never meets.
--
-- The whole check is one statement, so two concurrent requests cannot both
-- read "4 of 5" and both proceed.
-- ============================================================

create table if not exists public.rate_limits (
  -- What is being limited, and for whom: "login:someone@example.com".
  -- Hashed by the caller when it contains anything personal.
  bucket text not null,
  window_start timestamptz not null,
  attempts integer not null default 0,

  primary key (bucket, window_start)
);

-- Old windows are dead weight; nothing reads them once they have passed.
create index if not exists rate_limits_window_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
alter table public.rate_limits force row level security;

-- No policies at all. Only the SECURITY DEFINER function below touches
-- this table — a client that could read it would learn how close it is to
-- a limit, and one that could write would simply reset its own counter.

-- ---------- the check ----------

create or replace function public.check_rate_limit(
  p_bucket text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  window_start timestamptz;
  current_attempts integer;
begin
  -- Fixed windows rather than a sliding log: far cheaper, and the edge
  -- case (a burst spanning two windows) is acceptable for the volumes
  -- this app sees.
  window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  -- Insert-or-increment in a single statement. Two requests arriving
  -- together cannot both see the same count and both be allowed through.
  insert into public.rate_limits (bucket, window_start, attempts)
  values (p_bucket, window_start, 1)
  on conflict (bucket, window_start)
  do update set attempts = public.rate_limits.attempts + 1
  returning attempts into current_attempts;

  -- Opportunistic cleanup, cheap enough to do inline.
  if random() < 0.01 then
    delete from public.rate_limits
    where window_start < now() - interval '1 day';
  end if;

  return jsonb_build_object(
    'allowed', current_attempts <= p_max_attempts,
    'attempts', current_attempts,
    'limit', p_max_attempts,
    'retry_after_seconds',
      greatest(
        0,
        ceil(extract(epoch from (window_start + make_interval(secs => p_window_seconds) - now())))
      )
  );
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
-- Only the service role calls this. It is invoked from server actions,
-- never from a browser: a client that could call it directly could burn
-- through somebody else's budget by guessing their bucket name.
