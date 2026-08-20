"use server";

import { revalidatePath } from "next/cache";

import type { AuthFormState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import {
  checkboxToBoolean,
  profileSettingsSchema,
} from "@/lib/validation/profile";

/**
 * Saves the settings a user is allowed to change about themselves.
 *
 * `role` and `status` are deliberately absent — they are not accepted here,
 * and RLS would reject them anyway.
 */
export async function updateProfileSettings(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = profileSettingsSchema.safeParse({
    fullName: formData.get("fullName"),
    timezone: formData.get("timezone"),
    reminderTime: formData.get("reminderTime"),
    notifyCheckIn: checkboxToBoolean(formData.get("notifyCheckIn")),
    notifyLunch: checkboxToBoolean(formData.get("notifyLunch")),
    notifyCheckOut: checkboxToBoolean(formData.get("notifyCheckOut")),
    notifyLeave: checkboxToBoolean(formData.get("notifyLeave")),
    notifyReminder: checkboxToBoolean(formData.get("notifyReminder")),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Session expire ho gaya. Dobara login karein." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      timezone: parsed.data.timezone,
      reminder_time: parsed.data.reminderTime,
      notify_check_in: parsed.data.notifyCheckIn,
      notify_lunch: parsed.data.notifyLunch,
      notify_check_out: parsed.data.notifyCheckOut,
      notify_leave: parsed.data.notifyLeave,
      notify_reminder: parsed.data.notifyReminder,
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: "Settings save nahi ho payin. Dobara try karein." };
  }

  revalidatePath("/app", "layout");
  return { ok: true, message: "Settings save ho gayin." };
}
