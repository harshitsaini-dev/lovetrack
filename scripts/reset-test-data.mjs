/**
 * Clears the state the E2E suite builds up, without touching the seeded
 * accounts themselves.
 *
 *   node scripts/reset-test-data.mjs
 *
 * Run this between local test runs: the attendance tests assume the day
 * starts fresh, and the pairing tests assume the two accounts are unpaired.
 * Uses the service role, so it is a local tool only.
 */

import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SVC) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const headers = {
  apikey: SVC,
  Authorization: `Bearer ${SVC}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

// Order matters only for readability — the foreign keys cascade.
const tables = [
  "risk_events",
  "attendance_events",
  "attendance_nonces",
  "attendance",
  "pair_permissions",
  "pairs",
];

for (const table of tables) {
  const res = await fetch(`${URL}/rest/v1/${table}?id=not.is.null`, {
    method: "DELETE",
    headers,
  });

  console.log(
    res.ok
      ? `cleared ${table}`
      : `FAILED ${table}: ${res.status} ${await res.text()}`,
  );
}

console.log("\nDone.");
