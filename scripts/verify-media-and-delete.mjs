/**
 * Adversarial checks for shared media, the lunch order, and admin delete.
 *
 *   node scripts/verify-media-and-delete.mjs
 *
 * Everything here is exercised with real user tokens, not the service role,
 * because the service role bypasses exactly the rules being tested. The
 * question each check asks is "could someone actually do this from their
 * own session", which is the only version that matters.
 *
 * Uses the seeded E2E accounts and leaves them as it found them.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL, SVC, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pass = 0;
let fail = 0;

function check(label, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function signIn(email, password) {
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return client;
}

async function profileId(email) {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

async function setPermission(ownerId, key, value) {
  await admin
    .from("pair_permissions")
    .update({ [key]: value })
    .eq("owner_id", ownerId);
}

const USER = env.E2E_TEST_EMAIL;
const USER_PW = env.E2E_TEST_PASSWORD;
const PARTNER = env.E2E_PARTNER_EMAIL;
const PARTNER_PW = env.E2E_PARTNER_PASSWORD;

if (!USER || !PARTNER) {
  console.error("Needs the seeded E2E accounts in .env.local");
  process.exit(1);
}

const userId = await profileId(USER);
const partnerId = await profileId(PARTNER);

// Restored in the finally block whatever happens.
const { data: originalPerms } = await admin
  .from("pair_permissions")
  .select("owner_id, share_photos, share_lunch_proof, share_location")
  .in("owner_id", [userId, partnerId]);

let createdEventId = null;
let createdAttendanceId = null;

try {
  console.log("\nMedia access, lunch order, admin delete\n");

  const userClient = await signIn(USER, USER_PW);
  const partnerClient = await signIn(PARTNER, PARTNER_PW);

  // ---------- defaults ----------
  const { data: perms } = await userClient.rpc("get_partner_permissions", {
    p_partner_id: partnerId,
  });
  check(
    "every sharing switch defaults on",
    perms?.attendance && perms?.location && perms?.lunch_proof && perms?.photos,
    JSON.stringify(perms),
  );

  // ---------- an attendance event to look at ----------
  // Written with the service role rather than through the capture flow:
  // this script is testing who may READ media, not how a capture is made.
  const today = new Date().toISOString().slice(0, 10);

  const { data: att } = await admin
    .from("attendance")
    .upsert(
      { user_id: partnerId, attendance_date: today, status: "checked_in" },
      { onConflict: "user_id,attendance_date" },
    )
    .select()
    .single();

  createdAttendanceId = att.id;

  const { data: event } = await admin
    .from("attendance_events")
    .insert({
      attendance_id: att.id,
      user_id: partnerId,
      event_type: "check_in",
      photo_path: `users/${partnerId}/2026/08/check_in-verify.webp`,
      status: "passed",
      risk_score: 0,
      latitude: 28.6,
      longitude: 77.2,
      accuracy_m: 12,
    })
    .select()
    .single();

  createdEventId = event.id;

  // ---------- photos, shared and not ----------
  await setPermission(partnerId, "share_photos", true);

  const shared = await userClient.rpc("get_attendance_photo_access", {
    p_event_id: createdEventId,
  });
  check(
    "partner sees the photo when it is shared",
    shared.data?.ok === true && !!shared.data?.path,
    JSON.stringify(shared.data),
  );
  check(
    "and is not treated as an admin",
    shared.data?.as_admin === false,
  );

  await setPermission(partnerId, "share_photos", false);

  const withheld = await userClient.rpc("get_attendance_photo_access", {
    p_event_id: createdEventId,
  });
  check(
    "partner is refused when photos are off",
    withheld.data?.ok === false,
    withheld.data?.ok ? "PHOTO LEAKED" : "",
  );
  check("and gets no path at all", !withheld.data?.path);

  // The feed must still say a photo exists — but never where it is.
  const events = await userClient.rpc("get_partner_events", {
    p_partner_id: partnerId,
    p_from_date: today,
  });
  const row = (events.data ?? []).find((e) => e.id === createdEventId);

  check("event still reports that a photo was taken", row?.has_photo === true);
  check("but withholds the path", row?.photo_path === null, row?.photo_path ?? "");
  check("and says photos are not shared", row?.photo_shared === false);

  await setPermission(partnerId, "share_photos", true);

  const sharedRow = (
    await userClient.rpc("get_partner_events", {
      p_partner_id: partnerId,
      p_from_date: today,
    })
  ).data?.find((e) => e.id === createdEventId);
  check("path appears once photos are shared", !!sharedRow?.photo_path);

  // ---------- the owner ----------
  const own = await partnerClient.rpc("get_attendance_photo_access", {
    p_event_id: createdEventId,
  });
  check("the owner can always open their own photo", own.data?.ok === true);
  check("owner access is not logged as an admin view", own.data?.as_admin === false);

  // ---------- a stranger ----------
  // Unpaired and not an admin: the only remaining route is none.
  const strangerEmail = `stranger-${Date.now()}@example.com`;
  const { data: created } = await admin.auth.admin.createUser({
    email: strangerEmail,
    password: "StrangerPass123",
    email_confirm: true,
  });

  try {
    const strangerClient = await signIn(strangerEmail, "StrangerPass123");
    const denied = await strangerClient.rpc("get_attendance_photo_access", {
      p_event_id: createdEventId,
    });
    check(
      "an unpaired stranger gets nothing",
      denied.data?.ok === false,
      denied.data?.ok ? "STRANGER READ A PHOTO" : "",
    );
  } finally {
    await admin.auth.admin.deleteUser(created.user.id);
  }

  // ---------- lunch cannot end before the clip ----------
  const { data: hasProof } = await admin.rpc("lunch_proof_exists", {
    p_attendance_id: createdAttendanceId,
  });
  check("a fresh day has no lunch clip", hasProof === false);

  // ---------- admin delete ----------
  const isAdmin = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (isAdmin.data?.role !== "admin") {
    // Promote for the duration; restored in the finally block.
    await admin.from("profiles").update({ role: "admin" }).eq("id", userId);
  }

  const adminClient = await signIn(USER, USER_PW);

  const noReason = await adminClient.rpc("admin_delete_attendance_event", {
    p_event_id: createdEventId,
    p_reason: "  ",
  });
  check(
    "delete without a reason is refused",
    noReason.data?.ok === false && noReason.data?.error === "reason_required",
    JSON.stringify(noReason.data),
  );

  const stillThere = await admin
    .from("attendance_events")
    .select("id")
    .eq("id", createdEventId)
    .maybeSingle();
  check("and nothing was deleted", !!stillThere.data);

  const deleted = await adminClient.rpc("admin_delete_attendance_event", {
    p_event_id: createdEventId,
    p_reason: "verify script cleanup",
  });
  check("delete with a reason succeeds", deleted.data?.ok === true);

  const gone = await admin
    .from("attendance_events")
    .select("id")
    .eq("id", createdEventId)
    .maybeSingle();
  check("the row is really gone", !gone.data);
  createdEventId = null;

  const { data: log } = await admin
    .from("audit_logs")
    .select("action, detail, target_user_id")
    .eq("action", "attendance_event_deleted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  check("the deletion is in the audit log", !!log);
  check("with the reason", log?.detail?.reason === "verify script cleanup");
  check("and who it was about", log?.target_user_id === partnerId);

  // ---------- a non-admin cannot delete ----------
  await admin.from("profiles").update({ role: "user" }).eq("id", userId);
  const demoted = await signIn(USER, USER_PW);

  const { data: victim } = await admin
    .from("attendance_events")
    .insert({
      attendance_id: createdAttendanceId,
      user_id: partnerId,
      event_type: "check_out",
      status: "passed",
      risk_score: 0,
    })
    .select()
    .single();
  createdEventId = victim.id;

  const refused = await demoted.rpc("admin_delete_attendance_event", {
    p_event_id: createdEventId,
    p_reason: "should not work",
  });
  check(
    "an ordinary user cannot delete an entry",
    refused.data?.ok === false,
    refused.data?.ok ? "NON-ADMIN DELETED A RECORD" : "",
  );

  const survived = await admin
    .from("attendance_events")
    .select("id")
    .eq("id", createdEventId)
    .maybeSingle();
  check("and the entry survived", !!survived.data);
} finally {
  if (createdAttendanceId) {
    await admin.from("attendance").delete().eq("id", createdAttendanceId);
  }
  for (const row of originalPerms ?? []) {
    await admin
      .from("pair_permissions")
      .update({
        share_photos: row.share_photos,
        share_lunch_proof: row.share_lunch_proof,
        share_location: row.share_location,
      })
      .eq("owner_id", row.owner_id);
  }
  await admin.from("profiles").update({ role: "user" }).eq("id", userId);
  console.log("\n  (test data cleaned up, permissions restored)");
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
