/**
 * Clears the attendance state the suites build up.
 *
 * Both the attendance and lunch specs walk the same shared account through
 * "a day", so neither can assume it runs first. Each resets in beforeAll,
 * which makes the files independent of execution order.
 *
 * Uses the service role, which is why this lives only in the test harness.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABLES = [
  "risk_events",
  "lunch_proofs",
  "attendance_events",
  "attendance_nonces",
  "attendance",
  // Leave belongs here too: a day recorded by a previous run would make
  // the next one see "already recorded" on its first attempt.
  "leave_requests",
  // And the email log, whose dedup key would otherwise suppress a send the
  // reminder tests expect to happen.
  "email_logs",
];

function serviceHeaders() {
  return {
    apikey: SVC!,
    Authorization: `Bearer ${SVC}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

export async function resetAttendanceState(): Promise<void> {
  if (!URL || !SVC) return;

  for (const table of TABLES) {
    await fetch(`${URL}/rest/v1/${table}?id=not.is.null`, {
      method: "DELETE",
      headers: serviceHeaders(),
    });
  }
}

/**
 * Clears the rate-limit counters.
 *
 * The suite signs in dozens of times as the same account from the same
 * address, which is exactly the pattern the login limit exists to stop —
 * six attempts a minute is generous for a person and nowhere near enough
 * for a test run.
 *
 * Resetting the counter is the right fix. Raising the production limit to
 * suit the tests would weaken the thing being tested, and a bypass flag in
 * the app would put a hole in production code to make CI convenient.
 */
export async function clearRateLimits(): Promise<void> {
  if (!URL || !SVC) return;

  await fetch(`${URL}/rest/v1/rate_limits?bucket=not.is.null`, {
    method: "DELETE",
    headers: serviceHeaders(),
  });
}
