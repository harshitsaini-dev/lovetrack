/**
 * Rate limiting and security headers.
 *
 *   node scripts/verify-hardening.mjs
 *
 * The headers half needs the dev server running on port 3000.
 */

import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = "http://localhost:3000";

const admin = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };

let passed = 0;
let failed = 0;

function check(label, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function rpc(headers, fn, args) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers, body: JSON.stringify(args),
  });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; }
  catch { return { status: r.status, body: t }; }
}

const bucket = `verify-${Math.floor(Math.random() * 1e9)}`;

try {
  console.log("\n1. The counter behaves");
  {
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(
        (await rpc(admin, "check_rate_limit", {
          p_bucket: bucket, p_max_attempts: 3, p_window_seconds: 60,
        })).body,
      );
    }

    check("the first three are allowed",
      results.slice(0, 3).every((r) => r.allowed === true),
      JSON.stringify(results.map((r) => r.allowed)));

    check("the fourth and fifth are not",
      results.slice(3).every((r) => r.allowed === false),
      JSON.stringify(results.map((r) => r.allowed)));

    check("it counts every attempt, including the refused ones",
      results[4].attempts === 5, String(results[4].attempts));

    check("it says how long to wait",
      results[4].retry_after_seconds > 0 && results[4].retry_after_seconds <= 60,
      String(results[4].retry_after_seconds));
  }

  console.log("\n2. Buckets are independent");
  {
    const other = (await rpc(admin, "check_rate_limit", {
      p_bucket: `${bucket}-other`, p_max_attempts: 3, p_window_seconds: 60,
    })).body;

    check("a different bucket starts fresh",
      other.allowed === true && other.attempts === 1,
      JSON.stringify(other));
  }

  console.log("\n3. A client cannot reach the counter");
  {
    // No anon key call should be able to touch this: reading it reveals how
    // close you are, and writing it resets your own limit.
    const asAnon = await fetch(`${URL}/rest/v1/rpc/check_rate_limit`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ p_bucket: bucket, p_max_attempts: 3, p_window_seconds: 60 }),
    });
    check("the function is not callable with the anon key",
      asAnon.status >= 400, `status ${asAnon.status}`);

    const read = await fetch(`${URL}/rest/v1/rate_limits?select=*`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    const rows = await read.text();
    check("the table is not readable",
      read.status >= 400 || rows === "[]", `${read.status} ${rows.slice(0, 60)}`);

    // The one that actually leaked. It is SECURITY DEFINER with no
    // per-caller filter and returns email and full name, so anon reach
    // would have been an address-harvesting endpoint.
    const reminders = await fetch(`${URL}/rest/v1/rpc/users_due_for_reminder`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: "{}",
    });
    check("users_due_for_reminder is not callable with the anon key",
      reminders.status >= 400, `status ${reminders.status}`);
  }

  console.log("\n4. Security headers");
  {
    let res;
    try {
      res = await fetch(`${APP}/login`, { redirect: "manual" });
    } catch {
      console.log("  SKIP  dev server not running on :3000");
      res = null;
    }

    if (res) {
      const csp = res.headers.get("content-security-policy") ?? "";

      check("a CSP is sent", csp.length > 0);
      check("it carries a per-request nonce", /'nonce-[a-f0-9]{16,}'/.test(csp), csp.slice(0, 80));
      // The difference between a real CSP and a decorative one.
      check("script-src does not allow unsafe-inline",
        !/script-src[^;]*'unsafe-inline'/.test(csp),
        csp.match(/script-src[^;]*/)?.[0]?.slice(0, 100) ?? "");
      check("framing is refused", /frame-ancestors 'none'/.test(csp));
      check("form-action is pinned to self", /form-action 'self'/.test(csp));
      check("object-src is none", /object-src 'none'/.test(csp));

      const perms = res.headers.get("permissions-policy") ?? "";
      check("camera and geolocation are allowed for us",
        /camera=\(self\)/.test(perms) && /geolocation=\(self\)/.test(perms), perms.slice(0, 80));
      check("sensors the app never uses are switched off",
        /accelerometer=\(\)/.test(perms) && /usb=\(\)/.test(perms) && /payment=\(\)/.test(perms));

      check("nosniff", res.headers.get("x-content-type-options") === "nosniff");
      check("frame options deny", res.headers.get("x-frame-options") === "DENY");
      check("referrer policy set",
        (res.headers.get("referrer-policy") ?? "").includes("strict-origin"));

      // Two requests must not share a nonce, or it is not a nonce.
      const second = await fetch(`${APP}/login`, { redirect: "manual" });
      const nonceA = csp.match(/'nonce-([a-f0-9]+)'/)?.[1];
      const nonceB = (second.headers.get("content-security-policy") ?? "")
        .match(/'nonce-([a-f0-9]+)'/)?.[1];

      check("the nonce differs between requests", nonceA !== nonceB,
        `${nonceA?.slice(0, 8)} vs ${nonceB?.slice(0, 8)}`);
    }
  }
} catch (err) {
  console.error("\nERROR:", err.message);
  failed++;
} finally {
  await fetch(`${URL}/rest/v1/rate_limits?bucket=like.verify-*`, {
    method: "DELETE", headers: admin,
  }).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
