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
 * Idempotent by construction: `users_due_for_reminder()` excludes anyone
 * who already received today's mail, and a unique index on the email log
 * catches anything that slips through a concurrent run.
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

/** What is still outstanding, phrased for the email. */
function pendingSteps(status: AttendanceStatus): string[] {
  switch (status) {
    case "not_started":
      return ["Check-in", "Check-out"];
    case "checked_in":
      return ["Check-out"];
    case "lunch_active":
      return ["Lunch end", "Check-out"];
    case "lunch_verified":
      return ["Check-out"];
    default:
      return [];
  }
}

type DueUser = {
  user_id: string;
  email: string;
  full_name: string | null;
  timezone: string;
  local_date: string;
  attendance_status: AttendanceStatus;
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
    const pending = pendingSteps(user.attendance_status);

    if (pending.length === 0) {
      skipped++;
      continue;
    }

    const content = reminderEmail(user.full_name, pending, appUrl);

    const result = await sendEmail({
      to: user.email,
      userId: user.user_id,
      template: "daily_reminder",
      // Their local date, so someone who crosses a timezone still gets
      // exactly one reminder per day of their own.
      dedupKey: user.local_date,
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
