import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { sendEmail } from "@/lib/email/send";
import { reminderEmail } from "@/lib/email/templates";
import { getAppUrl } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/attendance";

/**
 * Daily activity reminder.
 *
 * Meant to be called frequently — every 15 minutes or so — rather than once
 * at a fixed hour. Each user picks their own reminder time in their own
 * timezone, so there is no single moment when "the reminders go out"; the
 * database works out who is due on each pass.
 *
 * There are two nudges, not one: a check-in reminder when the day never
 * started, and a check-out reminder when it never closed. They are due at
 * different times of day, and each user's times are set either by them or by
 * a partner. The database works out which, if either, is outstanding.
 *
 * Idempotent by construction: `users_due_for_reminder()` excludes anyone who
 * already received that kind of mail today, and a unique index on the email
 * log catches anything that slips through a concurrent run.
 */

export const dynamic = "force-dynamic";

/** Constant-time compare, so the secret cannot be guessed by timing. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;

  // Without a configured secret this endpoint would be an open mailer, so
  // it refuses to run at all rather than defaulting to permissive.
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";

  return bearer.length > 0 && secretMatches(bearer, expected);
}

type DueUser = {
  user_id: string;
  email: string;
  full_name: string | null;
  timezone: string;
  local_date: string;
  attendance_status: AttendanceStatus;
  /** Which nudge is due: the day never started, or never closed. */
  reminder_kind: "check_in" | "check_out";
};

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("users_due_for_reminder");

  if (error) {
    return NextResponse.json(
      { error: "query_failed", detail: error.message },
      { status: 500 },
    );
  }

  const due = (data ?? []) as DueUser[];
  const appUrl = getAppUrl();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of due) {
    const content = reminderEmail(user.full_name, user.reminder_kind, appUrl);

    const result = await sendEmail({
      to: user.email,
      userId: user.user_id,
      template: "daily_reminder",
      // Their local date AND the kind. The date alone would let the morning
      // check-in reminder suppress the evening check-out one, which is
      // exactly the bug splitting the times was meant to fix. The date is
      // theirs, so crossing a timezone still yields one of each per day.
      dedupKey: `${user.local_date}:${user.reminder_kind}`,
      ...content,
    });

    if (result.ok) sent++;
    else if (result.reason === "duplicate" || result.reason === "not_configured")
      skipped++;
    else failed++;
  }

  return NextResponse.json({
    ok: true,
    considered: due.length,
    sent,
    skipped,
    failed,
  });
}
