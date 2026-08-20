/**
 * Promotes or demotes an account.
 *
 *   node scripts/set-role.mjs you@example.com admin
 *   node scripts/set-role.mjs you@example.com user
 *
 * There is deliberately no way to do this from inside the app: the first
 * admin has to come from somewhere trusted, and "anyone can make themselves
 * an admin" is not a bootstrap, it is a hole. Local tool, service role.
 */

import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const [email, role = "admin"] = process.argv.slice(2);

if (!email || !["admin", "user"].includes(role)) {
  console.error("usage: node scripts/set-role.mjs <email> [admin|user]");
  process.exit(1);
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  apikey: SVC,
  Authorization: `Bearer ${SVC}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const res = await fetch(
  `${URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`,
  { method: "PATCH", headers, body: JSON.stringify({ role }) },
);

const body = await res.json();

if (!res.ok || body.length === 0) {
  console.error(`Could not update ${email}: ${res.status} ${JSON.stringify(body)}`);
  process.exit(1);
}

console.log(`${email} -> ${body[0].role}`);
