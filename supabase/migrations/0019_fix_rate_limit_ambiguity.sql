-- ============================================================
-- LoveTrack — Migration 0019: fix an ambiguous name in check_rate_limit
-- ============================================================
-- The PL/pgSQL variable was called `window_start`, which is also the
-- column name. Postgres refused every call with 42702:
--
--   column reference "window_start" is ambiguous
--
-- The caller fails open by design — locking everyone out of their own
-- attendance because a counter is down is worse than briefly unmetered
-- attempts — so the error was swallowed and every request was allowed.
-- Rate limiting had been doing nothing at all since it was added.
--
-- Worth noting how that reads: the feature looked present, the code path
-- ran, and nothing complained. It took a test that asserted the fourth
-- attempt is refused to notice.
-- ============================================================

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
  -- v_ prefix so it cannot collide with the column again.
  v_window_start timestamptz;
  v_attempts integer;
begin
  -- Fixed windows rather than a sliding log: far cheaper, and the edge
  -- case (a burst spanning two windows) is acceptable at this volume.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  -- Insert-or-increment in one statement. Two requests arriving together
  -- cannot both see the same count and both be allowed through.
  insert into public.rate_limits as rl (bucket, window_start, attempts)
  values (p_bucket, v_window_start, 1)
  on conflict (bucket, window_start)
  do update set attempts = rl.attempts + 1
  returning rl.attempts into v_attempts;

  -- Opportunistic cleanup, cheap enough to do inline.
  if random() < 0.01 then
    delete from public.rate_limits
    where window_start < now() - interval '1 day';
  end if;

  return jsonb_build_object(
    'allowed', v_attempts <= p_max_attempts,
    'attempts', v_attempts,
    'limit', p_max_attempts,
    'retry_after_seconds',
      greatest(
        0,
        ceil(extract(epoch from (
          v_window_start + make_interval(secs => p_window_seconds) - now()
        )))
      )
  );
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
