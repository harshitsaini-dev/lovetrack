/**
 * Creates (or resets) the end-to-end test account.
 *
 * Playwright's signed-in tests skip themselves unless E2E_TEST_EMAIL and
 * E2E_TEST_PASSWORD are set. Run this once, then keep those values in
 * .env.local so the full suite always runs.
 *
 *   node scripts/seed-e2e-user.mjs
 *
 * Uses the service-role key, so it is a local developer tool only — never
 * wire this into the app or a deployed environment.
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const env = {};
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (match) env[match[1]] = match[2].trim();
    }
  } catch {
    console.error("Could not read .env.local — run this from the repo root.");
    process.exit(1);
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local",
  );
  process.exit(1);
}

const email = env.E2E_TEST_EMAIL || "e2e.runner@lovetrack.dev";

// This account is real, so never ship a hardcoded default password. Reuse the
// one already in .env.local, otherwise mint a fresh random one and print it.
const password =
  env.E2E_TEST_PASSWORD ||
  `E2e${randomBytes(12).toString("base64url").replace(/[^A-Za-z0-9]/g, "")}9x`;

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

// Remove any previous run's account so the seed is idempotent.
const existing = await fetch(
  `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
  { headers },
).then((r) => r.json());

for (const user of existing.users ?? []) {
  if (user.email === email) {
    await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers,
    });
    console.log(`Removed existing account ${email}`);
  }
}

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "E2E Runner" },
  }),
});

if (!res.ok) {
  console.error(`Failed to create user: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const user = await res.json();
console.log(`\nCreated E2E account\n  email:    ${email}\n  password: ${password}\n  id:       ${user.id}\n`);
console.log("Add these to .env.local so Playwright picks them up:\n");
console.log(`E2E_TEST_EMAIL=${email}`);
console.log(`E2E_TEST_PASSWORD=${password}\n`);
