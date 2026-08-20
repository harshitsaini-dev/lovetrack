/**
 * Checks the retention tooling: who may run it, what it counts, and — the
 * part that matters — that clearing media does not destroy the record.
 *
 *   node scripts/verify-retention.mjs
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

const mkUser = async (email) =>
  (await (await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST", headers: admin,
    body: JSON.stringify({ email, password: "Retention123", email_confirm: true }),
  })).json()).id;

const rmUser = (id) =>
  fetch(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });

const tokenFor = async (email) =>
  (await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Retention123" }),
  })).json()).access_token;

const hdr = (t) => ({ apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

async function rpc(h, fn, args = {}) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: h, body: JSON.stringify(args),
  });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

const get = async (h, path) =>
  JSON.parse(await (await fetch(`${URL}/rest/v1/${path}`, { headers: h })).text());

const stamp = Math.floor(Math.random() * 100000);
const adminEmail = `ret.admin.${stamp}@lovetrack.dev`;
const userEmail = `ret.user.${stamp}@lovetrack.dev`;
let adminId, userId;

try {
  console.log("\nSetting up an admin and an ordinary user...");
  [adminId, userId] = await Promise.all([mkUser(adminEmail), mkUser(userEmail)]);

  await fetch(`${URL}/rest/v1/profiles?id=eq.${adminId}`, {
    method: "PATCH", headers: admin, body: JSON.stringify({ role: "admin" }),
  });

  const [tAdmin, tUser] = await Promise.all([tokenFor(adminEmail), tokenFor(userEmail)]);
  const A = hdr(tAdmin), U = hdr(tUser);

  console.log("\n1. Only admins may touch retention");
  {
    const preview = await rpc(U, "preview_retention_cleanup");
    check("an ordinary user cannot preview",
      preview.body?.ok === false && preview.body?.error === "forbidden",
      JSON.stringify(preview.body));

    const apply = await rpc(U, "apply_retention_cleanup");
    check("an ordinary user cannot run the cleanup",
      apply.body?.ok === false && apply.body?.error === "forbidden",
      JSON.stringify(apply.body));

    const list = await rpc(U, "list_expired_media");
    check("an ordinary user cannot list expired media",
      list.status >= 400 || list.body?.message?.includes("forbidden"),
      `${list.status} ${JSON.stringify(list.body)}`);

    const audit = await get(U, "audit_logs?select=id");
    check("an ordinary user cannot read the audit log",
      audit.length === 0, JSON.stringify(audit));
  }

  console.log("\n2. The preview reports what is there");
  {
    const preview = await rpc(A, "preview_retention_cleanup");
    check("an admin gets a preview", preview.body?.ok === true, JSON.stringify(preview.body));
    check("it reports the configured retention",
      typeof preview.body?.media_retention_days === "number",
      String(preview.body?.media_retention_days));
    check("records default to being kept forever",
      preview.body?.record_retention_days === 0,
      String(preview.body?.record_retention_days));
  }

  console.log("\n3. Old media ages out, the record survives");
  {
    // A day well past the 90-day default, with a photo attached.
    const attendance = await (await fetch(`${URL}/rest/v1/attendance`, {
      method: "POST", headers: { ...admin, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId, attendance_date: "2020-01-15", status: "checked_out",
        check_in_at: "2020-01-15T09:00:00Z", check_out_at: "2020-01-15T18:00:00Z",
      }),
    })).json();

    const event = await (await fetch(`${URL}/rest/v1/attendance_events`, {
      method: "POST", headers: { ...admin, Prefer: "return=representation" },
      body: JSON.stringify({
        attendance_id: attendance[0].id, user_id: userId, event_type: "check_in",
        server_timestamp: "2020-01-15T09:00:00Z",
        latitude: 28.62, longitude: 77.05, accuracy_m: 9,
        photo_path: `users/${userId}/2020/01/check_in-old.webp`,
        risk_score: 0, status: "passed",
      }),
    })).json();

    const preview = await rpc(A, "preview_retention_cleanup");
    check("the old photo shows up in the preview",
      preview.body?.photos >= 1, JSON.stringify(preview.body?.photos));

    const expired = await rpc(A, "list_expired_media");
    check("its storage path is listed for deletion",
      Array.isArray(expired.body) &&
        expired.body.some((row) => row.path?.includes("check_in-old")),
      JSON.stringify(expired.body));

    const applied = await rpc(A, "apply_retention_cleanup");
    check("the cleanup runs", applied.body?.ok === true, JSON.stringify(applied.body));
    check("it reports what it cleared",
      applied.body?.photos_cleared >= 1, String(applied.body?.photos_cleared));

    // The point of the whole design: the evidence goes, the record stays.
    const after = await get(admin, `attendance_events?select=id,photo_path,server_timestamp,latitude,status&id=eq.${event[0].id}`);
    check("the event still exists", after.length === 1, JSON.stringify(after));
    check("its photo path is cleared", after[0]?.photo_path === null, JSON.stringify(after[0]));
    check("its time survives", after[0]?.server_timestamp !== null, JSON.stringify(after[0]?.server_timestamp));
    check("its location survives", after[0]?.latitude !== null, JSON.stringify(after[0]?.latitude));
    check("its verdict survives", after[0]?.status === "passed", JSON.stringify(after[0]?.status));

    const day = await get(admin, `attendance?select=id,status&id=eq.${attendance[0].id}`);
    check("the attendance day survives (records default to forever)",
      day.length === 1, JSON.stringify(day));
  }

  console.log("\n4. The action is auditable");
  {
    const logs = await get(A, "audit_logs?select=action,actor_id,detail&order=created_at.desc&limit=1");
    check("the cleanup wrote an audit entry",
      logs[0]?.action === "retention_cleanup", JSON.stringify(logs[0]));
    check("it records who did it", logs[0]?.actor_id === adminId, JSON.stringify(logs[0]?.actor_id));
    check("it records what was removed",
      typeof logs[0]?.detail?.photos_cleared === "number", JSON.stringify(logs[0]?.detail));
  }
} catch (err) {
  console.error("\nERROR:", err.message);
  failed++;
} finally {
  console.log("\nCleaning up...");
  await Promise.all([adminId, userId].filter(Boolean).map(rmUser));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
