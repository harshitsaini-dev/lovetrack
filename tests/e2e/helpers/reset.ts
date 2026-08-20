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

export async function resetAttendanceState(): Promise<void> {
  if (!URL || !SVC) return;

  const headers = {
    apikey: SVC,
    Authorization: `Bearer ${SVC}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  for (const table of TABLES) {
    await fetch(`${URL}/rest/v1/${table}?id=not.is.null`, {
      method: "DELETE",
      headers,
    });
  }
}
