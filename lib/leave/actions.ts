"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { AuthFormState } from "@/lib/auth/actions";
import { requireProfile } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { notifyPartners } from "@/lib/notify/partners";
import { leaveRecordedEmail } from "@/lib/email/templates";
import { formatCalendarDate, getTodayInTimezone } from "@/lib/format/datetime";
import { LEAVE_TYPES } from "@/lib/leave/constants";
import { getAppUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const applySchema = z.object({
  leaveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sahi date chunein"),
  leaveType: z.enum(LEAVE_TYPES),
  reason: z
    .string()
    .trim()
    .min(3, "Reason likhna zaroori hai")
    .max(500, "Reason 500 characters se lamba nahi ho sakta"),
});

const ERRORS: Record<string, string> = {
  already_worked_that_day:
    "Us din aap kaam kar chuke hain — attendance already record hai.",
  duplicate: "Us din ki leave pehle se maujood hai.",
  past_limit: "Bahut purani date ki leave apply nahi kar sakte.",
};

export async function applyForLeave(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const profile = await requireProfile();

  const parsed = applySchema.safeParse({
    leaveDate: formData.get("leaveDate"),
    leaveType: formData.get("leaveType"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // Backdating a week is reasonable — people forget. Backdating a year is
  // rewriting history, and there is no honest use for it.
  const today = getTodayInTimezone(profile.timezone);
  const earliest = new Date(`${today}T00:00:00Z`);
  earliest.setUTCDate(earliest.getUTCDate() - 7);

  if (new Date(`${parsed.data.leaveDate}T00:00:00Z`) < earliest) {
    return { ok: false, error: ERRORS.past_limit };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("leave_requests").insert({
    user_id: profile.id,
    leave_date: parsed.data.leaveDate,
    leave_type: parsed.data.leaveType,
    reason: parsed.data.reason,
  });

  if (error) {
    // The database is the authority on both of these — a check here would
    // be a race, since attendance can land between the check and the write.
    if (error.message.includes("already_worked_that_day")) {
      return { ok: false, error: ERRORS.already_worked_that_day };
    }
    if (error.code === "23505") {
      return { ok: false, error: ERRORS.duplicate };
    }
    return { ok: false, error: "Leave apply nahi ho payi. Dobara try karein." };
  }

  if (profile.notify_leave) {
    const content = leaveRecordedEmail(
      formatCalendarDate(parsed.data.leaveDate),
      getAppUrl(),
    );

    // The result is ignored on purpose: a mail outage must not make a leave
    // that was successfully recorded look like it failed.
    await sendEmail({
      to: profile.email,
      userId: profile.id,
      template: "leave_recorded",
      dedupKey: parsed.data.leaveDate,
      ...content,
    });
  }

  // The point of recording leave is that somebody else knows not to expect
  // you. Telling only the person who typed it in was the confirmation, not
  // the message.
  await notifyPartners({
    actorId: profile.id,
    actorName: profile.full_name,
    kind: "leave",
    occurredOn: parsed.data.leaveDate,
    detail: parsed.data.reason,
  });

  revalidatePath("/app/leave");
  revalidatePath("/app/dashboard");

  return { ok: true, message: "Leave record ho gayi." };
}

/** Withdraws a leave entry that was recorded by mistake. */
export async function withdrawLeave(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = z.string().uuid().safeParse(formData.get("leaveId"));
  if (!parsed.success) return { ok: false, error: "Galat request." };

  const supabase = await createClient();

  // RLS allows this only on the caller's own row while it still stands, so
  // there is nothing further to check here.
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", parsed.data);

  if (error) {
    return { ok: false, error: "Hata nahi paye. Dobara try karein." };
  }

  revalidatePath("/app/leave");
  revalidatePath("/app/dashboard");

  return { ok: true, message: "Leave hata di gayi." };
}
