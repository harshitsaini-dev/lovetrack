/**
 * Leave rules and reminder eligibility.
 *
 * The interesting cases: you cannot approve your own leave, you cannot take
 * a day you already worked, and a reminder must not go to someone who is on
 * leave or has already been emailed today.
 *
 *   node scripts/verify-leave.mjs
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
    body: JSON.stringify({ email, password: "LeaveTest123", email_confirm: true }),
  })).json()).id;

const rmUser = (id) =>
  fetch(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });

const tokenFor = async (email) =>
  (await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "LeaveTest123" }),
  })).json()).access_token;

const hdr = (t) => ({ apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

async function post(h, table, body) {
  const r = await fetch(`${URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...h, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.text() };
}

async function patch(h, path, body) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method: "PATCH", headers: { ...h, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.text() };
}

const get = async (h, path) =>
  JSON.parse(await (await fetch(`${URL}/rest/v1/${path}`, { headers: h })).text());

const rpc = async (h, fn, args = {}) => {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: h, body: JSON.stringify(args),
  });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; }
  catch { return { status: r.status, body: t }; }
};

const stamp = Math.floor(Math.random() * 100000);
const emailA = `leave.a.${stamp}@lovetrack.dev`;
const emailB = `leave.b.${stamp}@lovetrack.dev`;
const emailC = `leave.c.${stamp}@lovetrack.dev`;
let idA, idB, idC;

// A date far enough back that no real data collides.
const LEAVE_DAY = "2021-03-11";
const WORKED_DAY = "2021-03-12";

try {
  // C is paired with nobody. Every "an outsider cannot do this" check needs
  // a real outsider holding a real token, not an absent one.
  console.log("\nSetting up three users...");
  [idA, idB, idC] = await Promise.all([
    mkUser(emailA), mkUser(emailB), mkUser(emailC),
  ]);
  const [tA, tB, tC] = await Promise.all([
    tokenFor(emailA), tokenFor(emailB), tokenFor(emailC),
  ]);
  const A = hdr(tA), B = hdr(tB), C = hdr(tC);

  console.log("\n1. A reason is genuinely required");
  {
    const empty = await post(A, "leave_requests", {
      user_id: idA, leave_date: LEAVE_DAY, reason: "  ",
    });
    check("whitespace is not a reason", empty.status >= 400, `status ${empty.status}`);

    const tiny = await post(A, "leave_requests", {
      user_id: idA, leave_date: LEAVE_DAY, reason: "x",
    });
    check("a single character is not a reason", tiny.status >= 400, `status ${tiny.status}`);
  }

  console.log("\n2. Recording leave, for yourself only");
  {
    const forOther = await post(A, "leave_requests", {
      user_id: idB, leave_date: LEAVE_DAY, reason: "Not my leave to take",
    });
    check("cannot record leave for someone else",
      forOther.status >= 400 || forOther.body === "[]", `status ${forOther.status}`);

    const ok = await post(A, "leave_requests", {
      user_id: idA, leave_date: LEAVE_DAY, reason: "Family function",
    });
    check("a proper entry is accepted", ok.status === 201, `status ${ok.status} ${ok.body}`);

    const recorded = JSON.parse(ok.body ?? "[]");
    check("it is simply 'recorded' — nothing to approve",
      recorded[0]?.status === "recorded", JSON.stringify(recorded[0]?.status));

    const dup = await post(A, "leave_requests", {
      user_id: idA, leave_date: LEAVE_DAY, reason: "Same day again",
    });
    check("the same day cannot be recorded twice", dup.status >= 400, `status ${dup.status}`);
  }

  console.log("\n3. A day cannot be both worked and taken off");
  {
    await fetch(`${URL}/rest/v1/attendance`, {
      method: "POST", headers: admin,
      body: JSON.stringify({
        user_id: idA, attendance_date: WORKED_DAY, status: "checked_out",
      }),
    });

    const clash = await post(A, "leave_requests", {
      user_id: idA, leave_date: WORKED_DAY, reason: "But I worked that day",
    });
    check("leave is refused for a day that was worked",
      clash.status >= 400 && clash.body.includes("already_worked"),
      `${clash.status} ${clash.body.slice(0, 120)}`);
  }

  console.log("\n4. Withdrawing is the only edit, and only by the owner");
  {
    const mine = await get(A, `leave_requests?select=id,status&leave_date=eq.${LEAVE_DAY}`);
    const leaveId = mine[0].id;

    const byOther = await patch(B, `leave_requests?id=eq.${leaveId}`, { status: "cancelled" });
    check("someone else cannot withdraw it",
      byOther.status >= 400 || byOther.body === "[]", `${byOther.status} ${byOther.body}`);

    // The reason is what the person said on the day; it must not become
    // rewritable afterwards.
    const editReason = await patch(A, `leave_requests?id=eq.${leaveId}`, {
      reason: "Actually a completely different reason",
    });
    check("the reason cannot be edited after the fact",
      editReason.status >= 400 || editReason.body === "[]",
      `${editReason.status} ${editReason.body}`);

    const withdraw = await patch(A, `leave_requests?id=eq.${leaveId}`, { status: "cancelled" });
    check("the owner can withdraw it",
      withdraw.status === 200 && withdraw.body !== "[]", `${withdraw.status} ${withdraw.body}`);

    const revive = await patch(A, `leave_requests?id=eq.${leaveId}`, { status: "recorded" });
    check("a withdrawn entry cannot be revived",
      revive.status >= 400 || revive.body === "[]", `${revive.status} ${revive.body}`);

    const again = await post(A, "leave_requests", {
      user_id: idA, leave_date: LEAVE_DAY, reason: "Re-recording after withdrawing",
    });
    check("the day is free again after withdrawing", again.status === 201, `status ${again.status}`);
  }

  console.log("\n5. Leave is private until shared");
  {
    const cross = await get(B, `leave_requests?select=id&user_id=eq.${idA}`);
    check("an unpaired user sees nothing", cross.length === 0, JSON.stringify(cross));

    await rpc(A, "request_pairing", { target_email: emailB });
    const pending = await get(B, "pairs?select=id&status=eq.pending");
    await fetch(`${URL}/rest/v1/pairs?id=eq.${pending[0].id}`, {
      method: "PATCH", headers: B, body: JSON.stringify({ status: "accepted" }),
    });

    // Sharing starts on for every switch (0021), so a paired partner sees
    // leave straight away. The assertion that carries weight is the one
    // after it: turning the switch off has to stop the read there and then.
    const paired = await get(B, `leave_requests?select=id&user_id=eq.${idA}`);
    check("a paired partner sees leave, since sharing starts on",
      paired.length > 0, JSON.stringify(paired));

    await fetch(`${URL}/rest/v1/pair_permissions?owner_id=eq.${idA}`, {
      method: "PATCH", headers: A, body: JSON.stringify({ share_leave: false }),
    });

    const hidden = await get(B, `leave_requests?select=id&user_id=eq.${idA}`);
    check("switching leave sharing off hides it immediately",
      hidden.length === 0, JSON.stringify(hidden));

    await fetch(`${URL}/rest/v1/pair_permissions?owner_id=eq.${idA}`, {
      method: "PATCH", headers: A, body: JSON.stringify({ share_leave: true }),
    });

    const shared = await get(B, `leave_requests?select=id&user_id=eq.${idA}`);
    check("and switching it back on restores it",
      shared.length > 0, JSON.stringify(shared));
  }

  console.log("\n6. Reminder eligibility");
  {
    const today = new Date().toISOString().slice(0, 10);
    const listedAs = (rows, u) =>
      (rows ?? []).filter((row) => row.user_id === u).map((row) => row.reminder_kind);

    // B has not started the day, so the CHECK-IN reminder is the one due --
    // not the check-out one, which is the whole point of splitting them.
    await fetch(`${URL}/rest/v1/profiles?id=eq.${idB}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({
        check_in_reminder_time: "00:01",
        check_out_reminder_time: "23:59",
        notify_reminder: true,
      }),
    });

    const due = await rpc(admin, "users_due_for_reminder");
    check("a day that never started is due a check-in reminder",
      listedAs(due.body, idB).includes("check_in"),
      JSON.stringify(listedAs(due.body, idB)));

    check("and not a check-out one, since there is nothing to close",
      !listedAs(due.body, idB).includes("check_out"),
      JSON.stringify(listedAs(due.body, idB)));

    // Before the check-in time, nothing is due at all -- the time is what
    // makes it a reminder rather than a constant nag.
    await fetch(`${URL}/rest/v1/profiles?id=eq.${idB}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ check_in_reminder_time: "23:58" }),
    });

    const notYet = await rpc(admin, "users_due_for_reminder");
    check("nothing is due before the chosen time",
      listedAs(notYet.body, idB).length === 0,
      JSON.stringify(listedAs(notYet.body, idB)));

    await fetch(`${URL}/rest/v1/profiles?id=eq.${idB}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ check_in_reminder_time: "00:01" }),
    });

    // Someone on leave drops off entirely.
    await fetch(`${URL}/rest/v1/leave_requests`, {
      method: "POST", headers: admin,
      body: JSON.stringify({
        user_id: idB, leave_date: today, reason: "On leave today",
      }),
    });

    const afterLeave = await rpc(admin, "users_due_for_reminder");
    check("someone on leave today is not reminded",
      listedAs(afterLeave.body, idB).length === 0,
      JSON.stringify(listedAs(afterLeave.body, idB)));

    // And someone with reminders switched off is never included.
    await fetch(`${URL}/rest/v1/profiles?id=eq.${idA}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({
        check_in_reminder_time: "00:01",
        check_out_reminder_time: "00:01",
        notify_reminder: false,
      }),
    });

    const afterOptOut = await rpc(admin, "users_due_for_reminder");
    check("someone who turned reminders off is not included",
      listedAs(afterOptOut.body, idA).length === 0,
      JSON.stringify(listedAs(afterOptOut.body, idA)));
  }

  console.log("\n6b. A partner sets the reminder times");
  {
    // The point of the feature: you know when your friend should have
    // started, so you are the one who sets the nudge.
    const set = await rpc(A, "set_reminder_times", {
      p_user_id: idB, p_check_in: "09:15", p_check_out: "18:45",
    });
    check("a paired partner may set them", set.body?.ok === true,
      JSON.stringify(set.body));

    const row = (
      await get(
        admin,
        `profiles?select=check_in_reminder_time,check_out_reminder_time,reminder_set_by&id=eq.${idB}`,
      )
    )[0];

    check("the times actually changed",
      row?.check_in_reminder_time?.startsWith("09:15") &&
        row?.check_out_reminder_time?.startsWith("18:45"),
      JSON.stringify(row));

    // Recorded, so the settings screen can name who did it rather than
    // leaving a person wondering why their phone buzzed at 09:15.
    check("and it is recorded who set them", row?.reminder_set_by === idA,
      JSON.stringify(row?.reminder_set_by));

    // Setting your own clears that note, since a partner no longer did it.
    const own = await rpc(B, "set_reminder_times", {
      p_user_id: idB, p_check_in: "10:00", p_check_out: "20:00",
    });
    check("the owner may set their own", own.body?.ok === true,
      JSON.stringify(own.body));

    const afterOwn = (
      await get(admin, `profiles?select=reminder_set_by&id=eq.${idB}`)
    )[0];
    check("and doing so clears the partner attribution",
      afterOwn?.reminder_set_by === null, JSON.stringify(afterOwn));

    // The one that matters: a stranger must not be able to reach into
    // somebody's account and move their reminders around.
    const stranger = await rpc(C, "set_reminder_times", {
      p_user_id: idB, p_check_in: "03:00", p_check_out: "04:00",
    });
    check("an unpaired user may not set them",
      stranger.body?.ok === false && stranger.body?.error === "not_paired",
      JSON.stringify(stranger.body));

    const unchanged = (
      await get(admin, `profiles?select=check_in_reminder_time&id=eq.${idB}`)
    )[0];
    check("and nothing moved",
      unchanged?.check_in_reminder_time?.startsWith("10:00"),
      JSON.stringify(unchanged));
  }

  console.log("\n6c. Who gets told about somebody else's day");
  {
    // Both gates have to hold: the actor shares the category, AND the
    // recipient asked for that kind of mail. Either alone is not enough.
    await fetch(`${URL}/rest/v1/pair_permissions?owner_id=eq.${idA}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ share_attendance: true, share_leave: true }),
    });
    await fetch(`${URL}/rest/v1/profiles?id=eq.${idB}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ notify_check_in: true, notify_leave: true }),
    });

    const both = await rpc(A, "partners_to_notify", {
      p_actor_id: idA, p_permission: "attendance", p_kind: "check_in",
    });
    check("a sharing partner who wants the mail is listed",
      (both.body ?? []).some((r) => r.partner_id === idB),
      JSON.stringify(both.body));

    // Gate 1 off. Without this check, email would be a way straight around
    // the sharing switch: turn attendance off and still get told.
    await fetch(`${URL}/rest/v1/pair_permissions?owner_id=eq.${idA}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ share_attendance: false }),
    });

    const notShared = await rpc(A, "partners_to_notify", {
      p_actor_id: idA, p_permission: "attendance", p_kind: "check_in",
    });
    check("nobody is mailed about a category that is not shared",
      (notShared.body ?? []).length === 0, JSON.stringify(notShared.body));

    await fetch(`${URL}/rest/v1/pair_permissions?owner_id=eq.${idA}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ share_attendance: true }),
    });

    // Gate 2 off: the recipient does not want it.
    await fetch(`${URL}/rest/v1/profiles?id=eq.${idB}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ notify_check_in: false }),
    });

    const optedOut = await rpc(A, "partners_to_notify", {
      p_actor_id: idA, p_permission: "attendance", p_kind: "check_in",
    });
    check("nobody is mailed who switched that notification off",
      (optedOut.body ?? []).length === 0, JSON.stringify(optedOut.body));

    // The switches are per kind, not one blanket setting.
    const stillLeave = await rpc(A, "partners_to_notify", {
      p_actor_id: idA, p_permission: "leave", p_kind: "leave",
    });
    check("but leave mail still goes, since that switch is separate",
      (stillLeave.body ?? []).some((r) => r.partner_id === idB),
      JSON.stringify(stillLeave.body));

    // The one that matters: this must not become a way to read the email
    // addresses of other people's partners.
    const asOther = await rpc(C, "partners_to_notify", {
      p_actor_id: idA, p_permission: "leave", p_kind: "leave",
    });
    check("it cannot be asked about somebody else",
      (asOther.body ?? []).length === 0, JSON.stringify(asOther.body));
  }

  console.log("\n6d. Sharing does not have to be mutual");
  {
    /*
     * Nobody is obliged to share back. A shares attendance with B; B shares
     * nothing. The notifications have to follow the sharing, one direction
     * at a time -- otherwise turning your own sharing off would still leak
     * your day out through the other person's inbox.
     *
     * Each side has its own pair_permissions row, so this is really a check
     * that the right row is being read: the ACTOR's, not the recipient's.
     */
    await fetch(`${URL}/rest/v1/pair_permissions?owner_id=eq.${idA}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ share_attendance: true }),
    });
    await fetch(`${URL}/rest/v1/pair_permissions?owner_id=eq.${idB}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ share_attendance: false }),
    });

    // Both want the mail, so the only thing deciding it is who shares.
    await fetch(`${URL}/rest/v1/profiles?id=in.(${idA},${idB})`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ notify_check_in: true }),
    });

    const aActs = await rpc(A, "partners_to_notify", {
      p_actor_id: idA, p_permission: "attendance", p_kind: "check_in",
    });
    check("the sharer's check-in does reach the other person",
      (aActs.body ?? []).some((r) => r.partner_id === idB),
      JSON.stringify(aActs.body));

    const bActs = await rpc(B, "partners_to_notify", {
      p_actor_id: idB, p_permission: "attendance", p_kind: "check_in",
    });
    check("the non-sharer's check-in reaches nobody",
      (bActs.body ?? []).length === 0,
      (bActs.body ?? []).length ? "LEAKED WITHOUT SHARING" : "");

    // Put it back so later sections start from the shipped default.
    await fetch(`${URL}/rest/v1/pair_permissions?owner_id=eq.${idB}`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ share_attendance: true }),
    });
  }

  console.log("\n7. The email log cannot be forged");
  {
    const forge = await post(A, "email_logs", {
      user_id: idA, template: "daily_reminder", to_email: emailA, status: "sent",
    });
    check("a client cannot write a delivery record",
      forge.status >= 400, `status ${forge.status}`);

    const others = await get(A, `email_logs?select=id&user_id=eq.${idB}`);
    check("a user cannot read someone else's email log",
      others.length === 0, JSON.stringify(others));
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
