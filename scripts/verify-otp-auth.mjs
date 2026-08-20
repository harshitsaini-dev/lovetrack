/**
 * Adversarial checks for the OTP auth flow.
 *
 *   node scripts/verify-otp-auth.mjs
 *
 * Supabase's own mailer is no longer used at all: codes are minted with the
 * admin API, delivered through our Resend templates, and redeemed with
 * `verifyOtp`. That moves several guarantees from "Supabase handles it" to
 * "we handle it", so each one is checked here against the real project.
 *
 * Creates throwaway users and deletes them again.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function anonClient() {
  // A fresh client per sign-in attempt: a shared one carries the session
  // from the previous check and quietly makes the next one pass.
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const stamp = String(process.hrtime.bigint()).slice(-10);
const PASSWORD = "ProbePass123";

let pass = 0;
let fail = 0;
const created = [];

function check(label, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function makeUser(tag) {
  const email = `otp-${tag}-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: false,
    user_metadata: { full_name: "Probe User" },
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  created.push(data.user.id);
  return { email, id: data.user.id };
}

async function codeFor(email, type) {
  const { data, error } = await admin.auth.admin.generateLink({ type, email });
  if (error) throw new Error(`generateLink(${type}): ${error.message}`);
  return data.properties.email_otp;
}

try {
  console.log("\nOTP auth flow\n");

  // ---- signup confirmation ----
  const alice = await makeUser("alice");

  check("new account starts unconfirmed", await (async () => {
    const { data } = await admin.auth.admin.getUserById(alice.id);
    return !data.user.email_confirmed_at;
  })());

  const early = await anonClient().auth.signInWithPassword({
    email: alice.email,
    password: PASSWORD,
  });
  check(
    "unconfirmed account cannot sign in with its password",
    !!early.error,
    early.error ? "" : "SIGNED IN WITHOUT VERIFYING",
  );

  const aliceCode = await codeFor(alice.email, "magiclink");
  check("a signup code is issued", /^\d{6,10}$/.test(aliceCode));

  const wrong = await anonClient().auth.verifyOtp({
    email: alice.email,
    token: aliceCode.split("").reverse().join("") === aliceCode ? "000000" : aliceCode.split("").reverse().join(""),
    type: "email",
  });
  check("a wrong code is refused", !!wrong.error);

  // Someone else's valid code must not work on this address. Codes are
  // bound to an account, not merely valid in general.
  const bob = await makeUser("bob");
  const bobCode = await codeFor(bob.email, "magiclink");

  const crossed = await anonClient().auth.verifyOtp({
    email: alice.email,
    token: bobCode,
    type: "email",
  });
  check(
    "another account's code does not work",
    !!crossed.error,
    crossed.error ? "" : "CROSS-ACCOUNT CODE ACCEPTED",
  );

  const redeemed = await anonClient().auth.verifyOtp({
    email: alice.email,
    token: aliceCode,
    type: "email",
  });
  check("the right code returns a session", !!redeemed.data?.session, redeemed.error?.message);

  const { data: confirmedUser } = await admin.auth.admin.getUserById(alice.id);
  check(
    "redeeming the code confirms the address",
    !!confirmedUser.user.email_confirmed_at,
  );

  const replay = await anonClient().auth.verifyOtp({
    email: alice.email,
    token: aliceCode,
    type: "email",
  });
  check("a code cannot be redeemed twice", !!replay.error);

  const now = await anonClient().auth.signInWithPassword({
    email: alice.email,
    password: PASSWORD,
  });
  check("password sign-in works once confirmed", !!now.data?.session, now.error?.message);

  // ---- profile side effects ----
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, role, status, email")
    .eq("id", alice.id)
    .maybeSingle();

  check("the signup trigger created a profile", !!profile);
  check("full_name carried through user_metadata", profile?.full_name === "Probe User");
  check("email matches the account", profile?.email === alice.email);
  check("role cannot be set at signup", profile?.role === "user");
  check("status defaults to active", profile?.status === "active");

  // ---- password recovery ----
  const recoveryCode = await codeFor(alice.email, "recovery");
  check("a recovery code is issued", /^\d{6,10}$/.test(recoveryCode));

  // Supabase treats the `email` and `recovery` OTP types interchangeably:
  // a recovery code redeems fine when submitted as `email`, and vice versa.
  //
  // That is recorded here rather than asserted against, because it is
  // Supabase's behaviour and not something this app can change. It is also
  // not a privilege boundary — both types are single-use, bound to one
  // account, and both return an ordinary session, so confusing them grants
  // nothing extra. The real boundary is possession of a code that was
  // emailed to that address, and that holds.
  //
  // The consequence worth remembering: `mode` in the /verify URL is routing
  // only. Nothing may be authorised on the strength of it.
  const wrongType = await anonClient().auth.verifyOtp({
    email: alice.email,
    token: recoveryCode,
    type: "email",
  });
  check(
    "code types are interchangeable (documented Supabase behaviour)",
    !wrongType.error,
    wrongType.error ? "behaviour changed — re-check the mode assumptions" : "",
  );

  const recovered = await anonClient().auth.verifyOtp({
    email: alice.email,
    token: await codeFor(alice.email, "recovery"),
    type: "recovery",
  });
  check("a recovery code opens a session", !!recovered.data?.session, recovered.error?.message);

  // ---- the code must not be readable from anywhere in the app ----
  // Codes are emailed. `email_logs` records the subject of every send, and
  // admins can read that table — so a code in a subject line would be a
  // silent account-takeover path for any admin.
  const { data: logs } = await admin
    .from("email_logs")
    .select("subject, template")
    .in("template", ["verification_code", "password_reset_code"])
    .limit(50);

  const leaking = (logs ?? []).filter((row) => /\d{6,10}/.test(row.subject));
  check(
    "no verification code appears in a logged email subject",
    leaking.length === 0,
    leaking.length ? `${leaking.length} subject(s) contain a code` : "",
  );
} finally {
  for (const id of created) {
    await admin.auth.admin.deleteUser(id);
  }
  if (created.length) console.log(`\n  (${created.length} throwaway users deleted)`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
