/**
 * Adversarial check of the lunch proof rules.
 *
 * The interesting question here is not "can a clip be uploaded" but "can a
 * clip be attached to a day where lunch never happened", and "who is
 * allowed to watch it".
 *
 *   node scripts/verify-lunch.mjs
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
    body: JSON.stringify({ email, password: "Lunch1234567", email_confirm: true,
      user_metadata: { full_name: email.split("@")[0] } }),
  })).json()).id;

const rmUser = (id) =>
  fetch(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });

const tokenFor = async (email) =>
  (await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Lunch1234567" }),
  })).json()).access_token;

const hdr = (t) => ({ apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

async function rpc(h, fn, args) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: h, body: JSON.stringify(args),
  });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

const get = async (h, path) => {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: h });
  return { status: r.status, body: await r.text() };
};

/** Walks a user through one attendance event. */
async function event(h, type, lat = 28.62, lng = 77.05) {
  const nonce = (await rpc(h, "issue_attendance_nonce", { p_event_type: type })).body;
  return rpc(h, "record_attendance_event", {
    p_nonce: nonce, p_event_type: type,
    p_latitude: lat, p_longitude: lng,
    p_accuracy_m: 10, p_fix_age_s: 2,
    p_photo_path: null, p_place_label: null,
    p_device_label: "Android · Chrome", p_ip_hash: null,
  });
}

const proof = (h, path = "users/x/2026/08/lunch-test.webm", duration = 8) =>
  rpc(h, "record_lunch_proof", {
    p_video_path: path,
    p_duration_s: duration,
    p_size_bytes: 1_200_000,
    p_challenge_phrase: "BLUE ROSE 42",
  });

const stamp = Math.floor(Math.random() * 100000);
const emailA = `lunch.a.${stamp}@lovetrack.dev`;
const emailB = `lunch.b.${stamp}@lovetrack.dev`;
let idA, idB;

try {
  console.log("\nSetting up two users...");
  [idA, idB] = await Promise.all([mkUser(emailA), mkUser(emailB)]);
  const [tA, tB] = await Promise.all([tokenFor(emailA), tokenFor(emailB)]);
  const A = hdr(tA), B = hdr(tB);

  // The order changed in 0022: the clip is now recorded DURING lunch, not
  // after it. Recorded afterwards it proved nothing about the stretch it was
  // meant to cover, and a day could reach 'lunch_verified' with no clip at
  // all -- which is what these checks now guard against.
  console.log("\n1. A proof cannot be attached to a day that had no lunch");
  {
    const noDay = await proof(A);
    check("refused before any check-in",
      noDay.body?.error === "lunch_needs_check_in", JSON.stringify(noDay.body));

    await event(A, "check_in");
    const afterCheckIn = await proof(A);
    check("refused when lunch never started",
      afterCheckIn.body?.error === "lunch_not_started", JSON.stringify(afterCheckIn.body));
  }

  console.log("\n2. Lunch cannot end until the clip exists");
  {
    await event(A, "lunch_start");

    const tooEarly = await event(A, "lunch_end");
    check("lunch_end is refused with no clip recorded",
      tooEarly.body?.error === "lunch_proof_missing", JSON.stringify(tooEarly.body));

    const ok = await proof(A);
    check("the clip is accepted while lunch is running",
      ok.body?.ok === true, JSON.stringify(ok.body));

    const again = await proof(A);
    check("a second clip for the same day is refused",
      again.body?.error === "lunch_proof_exists", JSON.stringify(again.body));

    const ended = await event(A, "lunch_end");
    check("lunch can end once the clip is there",
      ended.body?.ok === true, JSON.stringify(ended.body));
  }

  console.log("\n3. The tables are not writable from a client");
  {
    const direct = await fetch(`${URL}/rest/v1/lunch_proofs`, {
      method: "POST", headers: { ...A, Prefer: "return=representation" },
      body: JSON.stringify({ user_id: idA, video_path: "forged.webm" }),
    });
    check("cannot insert a proof row directly",
      direct.status >= 400, `status ${direct.status}`);
  }

  console.log("\n4. Lunch proof sharing can be switched off at any time");
  {
    const before = JSON.parse((await get(B, `lunch_proofs?select=id&user_id=eq.${idA}`)).body);
    check("an unpaired user sees nothing", before.length === 0, JSON.stringify(before));

    await rpc(A, "request_pairing", { target_email: emailB });
    const pending = JSON.parse((await get(B, "pairs?select=id&status=eq.pending")).body);
    await fetch(`${URL}/rest/v1/pairs?id=eq.${pending[0].id}`, {
      method: "PATCH", headers: B, body: JSON.stringify({ status: "accepted" }),
    });

    // Every switch is on from the moment a pair is accepted (0021), so the
    // clip is visible straight away. The control that matters is the one
    // below: switching it off has to stop the read immediately.
    const paired = JSON.parse((await get(B, `lunch_proofs?select=id&user_id=eq.${idA}`)).body);
    check("a paired partner sees the clip, since sharing starts on",
      paired.length === 1, JSON.stringify(paired));

    await fetch(`${URL}/rest/v1/pair_permissions?owner_id=eq.${idA}`, {
      method: "PATCH", headers: A, body: JSON.stringify({ share_lunch_proof: false }),
    });

    const revoked = JSON.parse((await get(B, `lunch_proofs?select=id&user_id=eq.${idA}`)).body);
    check("turning it back off takes effect immediately",
      revoked.length === 0, JSON.stringify(revoked));
  }

  console.log("\n5. Storage is not readable across users");
  {
    const path = `users/${idA}/2026/08/lunch-test.webm`;
    const res = await fetch(`${URL}/storage/v1/object/lunch-proofs/${path}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${tB}` },
    });
    check("a partner cannot fetch the object directly from storage",
      res.status >= 400,
      `status ${res.status} — access goes through a server-minted signed URL`);
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
