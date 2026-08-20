/**
 * Admin powers, and their limits.
 *
 * Two questions worth being sure about: can an ordinary user reach any of
 * this, and does every action that touches somebody else leave a trace.
 *
 *   node scripts/verify-admin.mjs
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
    body: JSON.stringify({ email, password: "AdminTest123", email_confirm: true,
      user_metadata: { full_name: email.split("@")[0] } }),
  })).json()).id;

const rmUser = (id) =>
  fetch(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });

const tokenFor = async (email) =>
  (await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AdminTest123" }),
  })).json()).access_token;

const hdr = (t) => ({ apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

const promote = (id) =>
  fetch(`${URL}/rest/v1/profiles?id=eq.${id}`, {
    method: "PATCH", headers: admin, body: JSON.stringify({ role: "admin" }),
  });

async function rpc(h, fn, args = {}) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: h, body: JSON.stringify(args),
  });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; }
  catch { return { status: r.status, body: t }; }
}

const get = async (h, path) =>
  JSON.parse(await (await fetch(`${URL}/rest/v1/${path}`, { headers: h })).text());

const stamp = Math.floor(Math.random() * 100000);
const adminEmail = `adm.${stamp}@lovetrack.dev`;
const admin2Email = `adm2.${stamp}@lovetrack.dev`;
const userEmail = `usr.${stamp}@lovetrack.dev`;
let adminId, admin2Id, userId;

try {
  console.log("\nSetting up two admins and one ordinary user...");
  [adminId, admin2Id, userId] = await Promise.all([
    mkUser(adminEmail), mkUser(admin2Email), mkUser(userEmail),
  ]);
  await Promise.all([promote(adminId), promote(admin2Id)]);

  const [tAdmin, tUser] = await Promise.all([
    tokenFor(adminEmail), tokenFor(userEmail),
  ]);
  const A = hdr(tAdmin), U = hdr(tUser);

  console.log("\n1. None of it is reachable without the role");
  {
    for (const fn of ["admin_stats", "admin_list_users", "admin_flagged_events"]) {
      const r = await rpc(U, fn, {});
      const denied =
        r.body?.ok === false ||
        (Array.isArray(r.body) && r.body.length === 0) ||
        r.status >= 400;
      check(`${fn} gives an ordinary user nothing`, denied, JSON.stringify(r.body).slice(0, 120));
    }

    const suspend = await rpc(U, "admin_set_user_status", {
      p_user_id: adminId, p_status: "suspended",
    });
    check("an ordinary user cannot suspend anyone",
      suspend.body?.error === "forbidden", JSON.stringify(suspend.body));

    const log = await rpc(U, "admin_log_media_view", {
      p_target_user_id: adminId, p_kind: "attendance-media", p_path: "x",
    });
    check("an ordinary user cannot write to the audit log",
      log.body?.error === "forbidden", JSON.stringify(log.body));

    const direct = await fetch(`${URL}/rest/v1/audit_logs`, {
      method: "POST", headers: { ...U, Prefer: "return=representation" },
      body: JSON.stringify({ action: "forged", actor_id: userId }),
    });
    check("nor forge an entry directly", direct.status >= 400, `status ${direct.status}`);
  }

  console.log("\n2. Stats and listings work for an admin");
  {
    const stats = (await rpc(A, "admin_stats")).body;
    check("stats come back", stats?.ok === true, JSON.stringify(stats).slice(0, 120));
    check("users are counted", typeof stats?.users === "number", String(stats?.users));

    const users = (await rpc(A, "admin_list_users", { p_search: null })).body;
    check("the user list includes our test user",
      users.some((u) => u.id === userId), JSON.stringify(users.length));

    const searched = (await rpc(A, "admin_list_users", { p_search: `usr.${stamp}` })).body;
    check("search narrows it", searched.length === 1 && searched[0].id === userId,
      JSON.stringify(searched.map((u) => u.email)));
  }

  console.log("\n3. Suspension rules");
  {
    const self = await rpc(A, "admin_set_user_status", {
      p_user_id: adminId, p_status: "suspended",
    });
    check("an admin cannot suspend themselves",
      self.body?.error === "cannot_suspend_self", JSON.stringify(self.body));

    const otherAdmin = await rpc(A, "admin_set_user_status", {
      p_user_id: admin2Id, p_status: "suspended",
    });
    check("an admin cannot suspend another admin",
      otherAdmin.body?.error === "cannot_suspend_admin", JSON.stringify(otherAdmin.body));

    const suspend = await rpc(A, "admin_set_user_status", {
      p_user_id: userId, p_status: "suspended", p_reason: "Testing suspension",
    });
    check("an ordinary user can be suspended", suspend.body?.ok === true,
      JSON.stringify(suspend.body));

    const profile = await get(admin, `profiles?select=status&id=eq.${userId}`);
    check("the account really is suspended", profile[0]?.status === "suspended",
      JSON.stringify(profile[0]));

    const restore = await rpc(A, "admin_set_user_status", {
      p_user_id: userId, p_status: "active",
    });
    check("and can be restored", restore.body?.ok === true, JSON.stringify(restore.body));
  }

  console.log("\n4. Everything leaves a trace");
  {
    const logs = await get(A, `audit_logs?select=action,actor_id,target_user_id,detail&target_user_id=eq.${userId}&order=created_at.desc`);

    check("the suspension was logged",
      logs.some((l) => l.action === "user_suspended"), JSON.stringify(logs.map((l) => l.action)));
    check("the restore was logged",
      logs.some((l) => l.action === "user_restored"), JSON.stringify(logs.map((l) => l.action)));
    check("the reason was kept",
      logs.some((l) => l.detail?.reason === "Testing suspension"),
      JSON.stringify(logs.map((l) => l.detail)));
    check("the acting admin is named",
      logs.every((l) => l.actor_id === adminId), JSON.stringify(logs.map((l) => l.actor_id)));

    // Opening somebody's photograph is itself an event.
    await rpc(A, "admin_log_media_view", {
      p_target_user_id: userId, p_kind: "attendance-media", p_path: "users/x/photo.webp",
    });
    const views = await get(A, `audit_logs?select=action,detail&action=eq.media_viewed&target_user_id=eq.${userId}`);
    check("viewing evidence is logged", views.length === 1, JSON.stringify(views));
    check("with the path that was opened",
      views[0]?.detail?.path === "users/x/photo.webp", JSON.stringify(views[0]?.detail));
  }

  console.log("\n5. Settings changes are recorded with before and after");
  {
    const before = (await get(A, "system_settings?select=max_accuracy_m"))[0];

    await fetch(`${URL}/rest/v1/system_settings?id=eq.true`, {
      method: "PATCH", headers: A, body: JSON.stringify({ max_accuracy_m: 123 }),
    });

    const logs = await get(A, "audit_logs?select=action,detail&action=eq.settings_changed&order=created_at.desc&limit=1");
    check("the change was logged", logs.length === 1, JSON.stringify(logs));
    check("with the old value",
      logs[0]?.detail?.before?.max_accuracy_m === before.max_accuracy_m,
      JSON.stringify(logs[0]?.detail?.before?.max_accuracy_m));
    check("and the new one",
      logs[0]?.detail?.after?.max_accuracy_m === 123,
      JSON.stringify(logs[0]?.detail?.after?.max_accuracy_m));

    // Put it back.
    await fetch(`${URL}/rest/v1/system_settings?id=eq.true`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ max_accuracy_m: before.max_accuracy_m }),
    });

    const byUser = await fetch(`${URL}/rest/v1/system_settings?id=eq.true`, {
      method: "PATCH", headers: U, body: JSON.stringify({ max_accuracy_m: 999 }),
    });
    const stillSame = (await get(admin, "system_settings?select=max_accuracy_m"))[0];
    check("an ordinary user cannot change the thresholds",
      stillSame.max_accuracy_m === before.max_accuracy_m,
      `status ${byUser.status}, value ${stillSame.max_accuracy_m}`);
  }
} catch (err) {
  console.error("\nERROR:", err.message);
  failed++;
} finally {
  console.log("\nCleaning up...");
  await Promise.all([adminId, admin2Id, userId].filter(Boolean).map(rmUser));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
