/**
 * Adversarial check of the attendance verification engine.
 *
 * Tries to do the things a determined user would try: replay a nonce, skip
 * a step, write the tables directly, submit a stale or vague location, and
 * read someone else's records.
 *
 *   node scripts/verify-attendance.mjs
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
    body: JSON.stringify({ email, password: "Attend123456", email_confirm: true,
      user_metadata: { full_name: email.split("@")[0] } }),
  })).json()).id;

const rmUser = (id) =>
  fetch(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });

const tokenFor = async (email) =>
  (await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Attend123456" }),
  })).json()).access_token;

const hdr = (t) => ({ apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

async function rpc(h, fn, args) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: h, body: JSON.stringify(args),
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

async function get(h, path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: h });
  return { status: r.status, body: await r.text() };
}

/** Sensible defaults so each test only states what it is actually varying. */
async function submit(h, nonce, overrides = {}) {
  return rpc(h, "record_attendance_event", {
    p_nonce: nonce,
    p_event_type: "check_in",
    p_latitude: 28.6205,
    p_longitude: 77.0521,
    p_accuracy_m: 8,
    p_fix_age_s: 2,
    p_photo_path: null,
    p_place_label: null,
    p_device_label: "Android · Chrome",
    p_ip_hash: null,
    ...overrides,
  });
}

const stamp = Math.floor(Math.random() * 100000);
const emailA = `att.a.${stamp}@lovetrack.dev`;
const emailB = `att.b.${stamp}@lovetrack.dev`;
let idA, idB;

try {
  console.log("\nSetting up two users...");
  [idA, idB] = await Promise.all([mkUser(emailA), mkUser(emailB)]);
  const [tA, tB] = await Promise.all([tokenFor(emailA), tokenFor(emailB)]);
  const A = hdr(tA), B = hdr(tB);

  console.log("\n1. The tables are not writable from a client");
  {
    const ins = await fetch(`${URL}/rest/v1/attendance_events`, {
      method: "POST", headers: { ...A, Prefer: "return=representation" },
      body: JSON.stringify({ user_id: idA, event_type: "check_in", risk_score: 0, status: "passed" }),
    });
    check("cannot insert an attendance event directly",
      ins.status >= 400, `status ${ins.status}`);

    const ins2 = await fetch(`${URL}/rest/v1/attendance`, {
      method: "POST", headers: { ...A, Prefer: "return=representation" },
      body: JSON.stringify({ user_id: idA, attendance_date: "2026-01-01", status: "checked_out" }),
    });
    check("cannot insert an attendance day directly",
      ins2.status >= 400, `status ${ins2.status}`);
  }

  console.log("\n2. A good check-in is accepted");
  let firstNonce;
  {
    const n = await rpc(A, "issue_attendance_nonce", { p_event_type: "check_in" });
    firstNonce = n.body;
    check("a nonce is issued", typeof firstNonce === "string" && firstNonce.length === 36);

    const res = await submit(A, firstNonce);
    check("check-in passes", res.body?.ok === true && res.body?.status === "passed",
      JSON.stringify(res.body));
    check("the server stamped the time itself",
      typeof res.body?.server_time === "string", JSON.stringify(res.body?.server_time));
    check("risk score is zero for a clean submission",
      res.body?.risk_score === 0, String(res.body?.risk_score));
  }

  console.log("\n3. Nonces are single use");
  {
    const replay = await submit(A, firstNonce);
    check("the same nonce cannot be replayed",
      replay.body?.ok === false && replay.body?.error === "nonce_already_used",
      JSON.stringify(replay.body));

    const nb = await rpc(B, "issue_attendance_nonce", { p_event_type: "check_in" });
    const stolen = await submit(A, nb.body);
    check("another user's nonce is refused",
      stolen.body?.ok === false && stolen.body?.error === "invalid_nonce",
      JSON.stringify(stolen.body));

    const wrongType = await rpc(A, "issue_attendance_nonce", { p_event_type: "check_out" });
    const mismatched = await submit(A, wrongType.body, { p_event_type: "check_in" });
    check("a nonce issued for another action is refused",
      mismatched.body?.ok === false && mismatched.body?.error === "nonce_wrong_action",
      JSON.stringify(mismatched.body));

    const bogus = await submit(A, "00000000-0000-0000-0000-000000000000");
    check("an unknown nonce is refused",
      bogus.body?.ok === false && bogus.body?.error === "invalid_nonce",
      JSON.stringify(bogus.body));
  }

  console.log("\n4. The state machine holds");
  {
    const n = await rpc(A, "issue_attendance_nonce", { p_event_type: "check_in" });
    const twice = await submit(A, n.body);
    check("cannot check in twice in one day",
      twice.body?.error === "already_checked_in", JSON.stringify(twice.body));

    const n2 = await rpc(A, "issue_attendance_nonce", { p_event_type: "lunch_end" });
    const noLunch = await submit(A, n2.body, { p_event_type: "lunch_end" });
    check("cannot end a lunch that never started",
      noLunch.body?.error === "lunch_not_started", JSON.stringify(noLunch.body));

    const n3 = await rpc(B, "issue_attendance_nonce", { p_event_type: "check_out" });
    const early = await submit(B, n3.body, { p_event_type: "check_out" });
    check("cannot check out before checking in",
      early.body?.error === "check_out_needs_check_in", JSON.stringify(early.body));
  }

  console.log("\n5. Implausible location readings are caught");
  {
    const n = await rpc(B, "issue_attendance_nonce", { p_event_type: "check_in" });
    const vague = await submit(B, n.body, { p_accuracy_m: 850 });
    check("a 850m-accuracy fix is rejected",
      vague.body?.ok === false && vague.body?.status === "rejected",
      JSON.stringify(vague.body));

    const stillNotIn = JSON.parse((await get(B, "attendance?select=status")).body);
    check("a rejected submission does not advance the day",
      stillNotIn[0]?.status === "not_started", JSON.stringify(stillNotIn));

    const n2 = await rpc(B, "issue_attendance_nonce", { p_event_type: "check_in" });
    const stale = await submit(B, n2.body, { p_fix_age_s: 600 });
    check("a 10-minute-old cached fix is rejected",
      stale.body?.ok === false, JSON.stringify(stale.body));

    const n3 = await rpc(B, "issue_attendance_nonce", { p_event_type: "check_in" });
    const borderline = await submit(B, n3.body, { p_accuracy_m: 70 });
    check("a 70m fix is accepted but flagged as low confidence",
      borderline.body?.ok === true && borderline.body?.status === "flagged",
      JSON.stringify(borderline.body));
  }

  console.log("\n6. Every score is explainable");
  {
    const signals = JSON.parse(
      (await get(B, "risk_events?select=signal,points,detail&order=created_at.desc&limit=5")).body,
    );
    check("risk signals were recorded", signals.length > 0, JSON.stringify(signals));
    check("each signal carries its own points",
      signals.every((s) => typeof s.points === "number"), JSON.stringify(signals));
  }

  console.log("\n7. Records stay private until explicitly shared");
  {
    const cross = JSON.parse((await get(B, `attendance_events?select=id&user_id=eq.${idA}`)).body);
    check("an unpaired user sees nothing of another's events",
      cross.length === 0, JSON.stringify(cross));

    const risk = JSON.parse((await get(B, `risk_events?select=id&user_id=eq.${idA}`)).body);
    check("risk events are never visible to anyone else",
      risk.length === 0, JSON.stringify(risk));

    // Pair them, with attendance shared by default but location opt-in.
    await rpc(A, "request_pairing", { target_email: emailB });
    const pending = JSON.parse((await get(B, "pairs?select=id&status=eq.pending")).body);
    await fetch(`${URL}/rest/v1/pairs?id=eq.${pending[0].id}`, {
      method: "PATCH", headers: B, body: JSON.stringify({ status: "accepted" }),
    });

    const shared = JSON.parse((await get(B, `attendance_events?select=id&user_id=eq.${idA}`)).body);
    check("once paired, a partner sees shared attendance events",
      shared.length > 0, JSON.stringify(shared));

    // Turn A's attendance sharing off; B should immediately lose access.
    await fetch(`${URL}/rest/v1/pair_permissions?owner_id=eq.${idA}`, {
      method: "PATCH", headers: A, body: JSON.stringify({ share_attendance: false }),
    });
    const revoked = JSON.parse((await get(B, `attendance_events?select=id&user_id=eq.${idA}`)).body);
    check("turning sharing off takes effect immediately",
      revoked.length === 0, JSON.stringify(revoked));

    const riskAfter = JSON.parse((await get(B, `risk_events?select=id&user_id=eq.${idA}`)).body);
    check("a partner never sees risk events, even while paired",
      riskAfter.length === 0, JSON.stringify(riskAfter));
  }
} catch (err) {
  console.error("\nERROR:", err.message);
  failed++;
} finally {
  console.log("\nCleaning up...");
  await Promise.all([idA, idB].filter(Boolean).map(rmUser));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
