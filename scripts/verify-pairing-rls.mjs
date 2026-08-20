/**
 * Adversarial check of the pairing RLS policies against the live database.
 *
 * Creates two throwaway users, walks them through a real pairing, then tries
 * to break it from each side. Cleans up after itself.
 *
 *   node scripts/verify-pairing-rls.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const env = {};
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnvLocal();
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

async function createUser(email) {
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({
      email,
      password: "PairTest123",
      email_confirm: true,
      user_metadata: { full_name: email.split("@")[0] },
    }),
  });
  if (!res.ok) throw new Error(`createUser ${email}: ${await res.text()}`);
  return (await res.json()).id;
}

async function deleteUser(id) {
  await fetch(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });
}

async function tokenFor(email) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "PairTest123" }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${await res.text()}`);
  return (await res.json()).access_token;
}

const as = (token) => ({
  apikey: ANON,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

async function rpc(headers, fn, args) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  return { status: res.status, body: await res.text() };
}

async function get(headers, path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers });
  return { status: res.status, body: await res.text() };
}

async function patch(headers, path, payload) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.text() };
}

const stamp = Math.floor(Math.random() * 100000);
const emailA = `pair.a.${stamp}@lovetrack.dev`;
const emailB = `pair.b.${stamp}@lovetrack.dev`;
const emailC = `pair.c.${stamp}@lovetrack.dev`;

let idA, idB, idC;

try {
  console.log("\nSetting up three users...");
  [idA, idB, idC] = await Promise.all([
    createUser(emailA),
    createUser(emailB),
    createUser(emailC),
  ]);

  const [tokA, tokB, tokC] = await Promise.all([
    tokenFor(emailA),
    tokenFor(emailB),
    tokenFor(emailC),
  ]);
  const A = as(tokA), B = as(tokB), C = as(tokC);

  console.log("\n1. Requesting a pair");
  {
    const r = await rpc(A, "request_pairing", { target_email: emailB });
    check("A can request pairing with B", r.body.includes("sent"), r.body);

    const self = await rpc(A, "request_pairing", { target_email: emailA });
    check("self-pairing is refused", self.body.includes("self"), self.body);

    const dup = await rpc(A, "request_pairing", { target_email: emailB });
    check("duplicate request is refused", dup.body.includes("exists"), dup.body);

    const ghost = await rpc(A, "request_pairing", {
      target_email: `nobody.${stamp}@lovetrack.dev`,
    });
    check(
      "unknown email returns the same 'sent' (no account enumeration)",
      ghost.body.includes("sent"),
      ghost.body,
    );
  }

  const pairsA = JSON.parse((await get(A, "pairs?select=*")).body);
  const pairId = pairsA[0]?.id;
  check("A sees the pair", !!pairId);

  console.log("\n2. Third parties cannot see or touch it");
  {
    const seen = JSON.parse((await get(C, "pairs?select=*")).body);
    check("C cannot see A and B's pair", seen.length === 0, JSON.stringify(seen));

    const hijack = await patch(C, `pairs?id=eq.${pairId}`, { status: "accepted" });
    check(
      "C cannot accept a pair they are not in",
      hijack.status === 403 || hijack.body === "[]",
      `${hijack.status} ${hijack.body}`,
    );
  }

  console.log("\n3. Only the receiver may accept");
  {
    const selfAccept = await patch(A, `pairs?id=eq.${pairId}`, { status: "accepted" });
    check(
      "requester cannot accept their own invite",
      selfAccept.status === 403 || selfAccept.body === "[]",
      `${selfAccept.status} ${selfAccept.body}`,
    );

    const accept = await patch(B, `pairs?id=eq.${pairId}`, { status: "accepted" });
    check("receiver can accept", accept.status === 200 && accept.body !== "[]", accept.body);
  }

  console.log("\n4. Permission rows are created on accept");
  const perms = JSON.parse((await get(A, `pair_permissions?select=*&pair_id=eq.${pairId}`)).body);
  check("two permission rows exist, one per user", perms.length === 2, JSON.stringify(perms));
  check(
    "location sharing is OFF by default (opt-in)",
    perms.every((p) => p.share_location === false),
  );
  check(
    "attendance sharing is ON by default",
    perms.every((p) => p.share_attendance === true),
  );

  console.log("\n5. Each user controls only their own sharing");
  {
    const own = await patch(A, `pair_permissions?pair_id=eq.${pairId}&owner_id=eq.${idA}`, {
      share_location: true,
    });
    check("A can enable sharing on their own row", own.status === 200 && own.body !== "[]", own.body);

    const other = await patch(A, `pair_permissions?pair_id=eq.${pairId}&owner_id=eq.${idB}`, {
      share_location: true,
    });
    check(
      "A cannot change what B shares",
      other.status === 403 || other.body === "[]",
      `${other.status} ${other.body}`,
    );

    const cView = JSON.parse((await get(C, "pair_permissions?select=*")).body);
    check("C cannot read anyone's permissions", cView.length === 0, JSON.stringify(cView));
  }

  console.log("\n6. can_view_shared() reflects the switches");
  {
    const yes = await rpc(B, "can_view_shared", { owner_user_id: idA, permission: "location" });
    check("B may view A's location once A enabled it", yes.body.trim() === "true", yes.body);

    const no = await rpc(A, "can_view_shared", { owner_user_id: idB, permission: "location" });
    check("A may not view B's location (B never enabled it)", no.body.trim() === "false", no.body);

    const outsider = await rpc(C, "can_view_shared", { owner_user_id: idA, permission: "location" });
    check("C may not view A's location", outsider.body.trim() === "false", outsider.body);
  }

  console.log("\n7. Revoking ends it immediately");
  {
    const revoke = await patch(B, `pairs?id=eq.${pairId}`, { status: "revoked" });
    check("B can revoke the pairing", revoke.status === 200 && revoke.body !== "[]", revoke.body);

    const after = await rpc(B, "can_view_shared", { owner_user_id: idA, permission: "location" });
    check(
      "sharing stops the moment the pair is revoked",
      after.body.trim() === "false",
      after.body,
    );

    const reRequest = await rpc(A, "request_pairing", { target_email: emailB });
    check(
      "a revoked pair does not block a fresh request",
      reRequest.body.includes("sent"),
      reRequest.body,
    );
  }

  // Regression guard for the bug fixed in migration 0005. The old policy
  // pinned the pair members with a subquery that returned one row while
  // only one pair existed, and blew up with 21000 once a second row for the
  // same two people appeared — so re-pairing after an unpair was impossible.
  console.log("\n8. Pairing again after a previous pairing");
  {
    const pending = JSON.parse(
      (await get(B, "pairs?select=id,status&status=eq.pending")).body,
    );
    check("the fresh request is pending", pending.length === 1, JSON.stringify(pending));

    const all = JSON.parse((await get(B, "pairs?select=id,status")).body);
    check(
      "both pair rows are visible to the receiver (the trigger condition)",
      all.length >= 2,
      JSON.stringify(all),
    );

    const accept = await patch(B, `pairs?id=eq.${pending[0].id}`, {
      status: "accepted",
    });
    check(
      "the second pairing can be accepted",
      accept.status === 200 && accept.body !== "[]",
      `${accept.status} ${accept.body}`,
    );
  }
} catch (err) {
  console.error("\nERROR:", err.message);
  failed++;
} finally {
  console.log("\nCleaning up...");
  await Promise.all([idA, idB, idC].filter(Boolean).map(deleteUser));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
