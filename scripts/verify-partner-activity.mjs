/**
 * The security question this phase turns on:
 *
 *   If A shares ATTENDANCE with B but not LOCATION, can B read where A was?
 *
 * Row-level security cannot answer that, because latitude and longitude are
 * columns on a row it has already granted. These checks confirm the
 * database functions close that gap — and that no direct table read
 * reopens it.
 *
 *   node scripts/verify-partner-activity.mjs
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
    body: JSON.stringify({ email, password: "Partner12345", email_confirm: true,
      user_metadata: { full_name: email.split("@")[0] } }),
  })).json()).id;

const rmUser = (id) =>
  fetch(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });

const tokenFor = async (email) =>
  (await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Partner12345" }),
  })).json()).access_token;

const hdr = (t) => ({ apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

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

const setPermission = (ownerId, key, value) =>
  fetch(`${URL}/rest/v1/pair_permissions?owner_id=eq.${ownerId}`, {
    method: "PATCH", headers: admin, body: JSON.stringify({ [key]: value }),
  });

const stamp = Math.floor(Math.random() * 100000);
const emailA = `pa.a.${stamp}@lovetrack.dev`;
const emailB = `pa.b.${stamp}@lovetrack.dev`;
const emailC = `pa.c.${stamp}@lovetrack.dev`;
let idA, idB, idC;

const LAT = 28.6205;
const LNG = 77.0521;

try {
  console.log("\nSetting up A (shares), B (partner) and C (outsider)...");
  [idA, idB, idC] = await Promise.all([mkUser(emailA), mkUser(emailB), mkUser(emailC)]);
  const [tA, tB, tC] = await Promise.all([tokenFor(emailA), tokenFor(emailB), tokenFor(emailC)]);
  const A = hdr(tA), B = hdr(tB), C = hdr(tC);

  // A records a real check-in through the engine.
  const nonce = (await rpc(A, "issue_attendance_nonce", { p_event_type: "check_in" })).body;
  await rpc(A, "record_attendance_event", {
    p_nonce: nonce, p_event_type: "check_in",
    p_latitude: LAT, p_longitude: LNG,
    p_accuracy_m: 9, p_fix_age_s: 2,
    p_photo_path: null, p_place_label: "Janakpuri, Delhi",
    p_device_label: "Android · Chrome", p_ip_hash: null,
  });

  // Pair them. Attendance defaults on, location defaults off.
  await rpc(A, "request_pairing", { target_email: emailB });
  const pending = await get(B, "pairs?select=id&status=eq.pending");
  await fetch(`${URL}/rest/v1/pairs?id=eq.${pending[0].id}`, {
    method: "PATCH", headers: B, body: JSON.stringify({ status: "accepted" }),
  });

  console.log("\n1. Attendance shared, location NOT shared");
  {
    const perms = (await rpc(B, "get_partner_permissions", { p_partner_id: idA })).body;
    check("permissions report attendance on, location off",
      perms?.attendance === true && perms?.location === false, JSON.stringify(perms));

    const days = (await rpc(B, "get_partner_days", { p_partner_id: idA })).body;
    check("the partner can see the day", days.length === 1, JSON.stringify(days.length));

    const events = (await rpc(B, "get_partner_events", { p_partner_id: idA })).body;
    check("the partner can see the event", events.length === 1, JSON.stringify(events.length));

    // This is the whole point of the migration.
    check("latitude is withheld", events[0]?.latitude === null, JSON.stringify(events[0]?.latitude));
    check("longitude is withheld", events[0]?.longitude === null, JSON.stringify(events[0]?.longitude));
    check("accuracy is withheld", events[0]?.accuracy_m === null, JSON.stringify(events[0]?.accuracy_m));
    check("the place NAME is withheld too — it is a location",
      events[0]?.place_label === null, JSON.stringify(events[0]?.place_label));
    check("but the time is there", events[0]?.server_timestamp != null,
      JSON.stringify(events[0]?.server_timestamp));
    check("and the UI is told location is not shared",
      events[0]?.location_shared === false, JSON.stringify(events[0]?.location_shared));
  }

  console.log("\n2. The direct table read cannot reopen the gap");
  {
    // The important one. A partner who skips the app and calls PostgREST
    // with their own token must get nothing — otherwise the location
    // switch only holds for people who use the intended screen.
    const rawEvents = await get(
      B,
      `attendance_events?select=latitude,longitude,server_timestamp&user_id=eq.${idA}`,
    );
    check("a raw event read returns nothing to a partner",
      rawEvents.length === 0, JSON.stringify(rawEvents));

    const rawDays = await get(B, `attendance?select=id,status&user_id=eq.${idA}`);
    check("a raw attendance read returns nothing to a partner",
      rawDays.length === 0, JSON.stringify(rawDays));

    // ...while the sanctioned route still works.
    const viaFunction = (await rpc(B, "get_partner_events", { p_partner_id: idA })).body;
    check("but the function still returns the event",
      viaFunction.length === 1, JSON.stringify(viaFunction.length));
  }

  console.log("\n3. Turning location on");
  {
    await setPermission(idA, "share_location", true);

    const events = (await rpc(B, "get_partner_events", { p_partner_id: idA })).body;
    check("coordinates appear once shared",
      Math.abs(events[0]?.latitude - LAT) < 0.001, JSON.stringify(events[0]?.latitude));
    check("the place name appears too",
      events[0]?.place_label === "Janakpuri, Delhi", JSON.stringify(events[0]?.place_label));
  }

  console.log("\n4. Turning attendance off hides everything");
  {
    await setPermission(idA, "share_attendance", false);

    const days = (await rpc(B, "get_partner_days", { p_partner_id: idA })).body;
    const events = (await rpc(B, "get_partner_events", { p_partner_id: idA })).body;

    check("days disappear", days.length === 0, JSON.stringify(days.length));
    check("events disappear", events.length === 0, JSON.stringify(events.length));

    const perms = (await rpc(B, "get_partner_permissions", { p_partner_id: idA })).body;
    check("permissions say so, so the UI can explain why it is empty",
      perms?.attendance === false, JSON.stringify(perms));
  }

  console.log("\n5. An outsider gets nothing, whatever the settings");
  {
    await setPermission(idA, "share_attendance", true);
    await setPermission(idA, "share_location", true);

    const days = (await rpc(C, "get_partner_days", { p_partner_id: idA })).body;
    const events = (await rpc(C, "get_partner_events", { p_partner_id: idA })).body;
    const perms = (await rpc(C, "get_partner_permissions", { p_partner_id: idA })).body;

    check("an unpaired user sees no days", days.length === 0, JSON.stringify(days.length));
    check("an unpaired user sees no events", events.length === 0, JSON.stringify(events.length));
    check("and every permission reads false",
      perms?.attendance === false && perms?.location === false, JSON.stringify(perms));
  }

  console.log("\n6. Rejected submissions are never activity");
  {
    // A submission bad enough to be rejected: 900m accuracy.
    const n = (await rpc(A, "issue_attendance_nonce", { p_event_type: "check_out" })).body;
    const rejected = await rpc(A, "record_attendance_event", {
      p_nonce: n, p_event_type: "check_out",
      p_latitude: LAT, p_longitude: LNG,
      p_accuracy_m: 900, p_fix_age_s: 2,
      p_photo_path: null, p_place_label: null,
      p_device_label: "Android · Chrome", p_ip_hash: null,
    });
    check("the submission was rejected", rejected.body?.status === "rejected",
      JSON.stringify(rejected.body?.status));

    const events = (await rpc(B, "get_partner_events", { p_partner_id: idA })).body;
    check("a rejected attempt is not shown to the partner",
      events.every((e) => e.event_type !== "check_out"),
      JSON.stringify(events.map((e) => e.event_type)));
  }
} catch (err) {
  console.error("\nERROR:", err.message);
  failed++;
} finally {
  console.log("\nCleaning up...");
  await Promise.all([idA, idB, idC].filter(Boolean).map(rmUser));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
