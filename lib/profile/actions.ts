"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { AuthFormState } from "@/lib/auth/actions";
import {
  checkRateLimitFor,
  rateLimitMessage,
} from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  changePasswordSchema,
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
    checkInReminderTime: formData.get("checkInReminderTime"),
    checkOutReminderTime: formData.get("checkOutReminderTime"),
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
      check_in_reminder_time: parsed.data.checkInReminderTime,
      check_out_reminder_time: parsed.data.checkOutReminderTime,
      // Back to the owner: changing your own times clears the note
      // saying a partner set them, because they no longer did.
      reminder_set_by: null,
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

/**
 * Changes the signed-in user's password.
 *
 * The current password is re-checked even though the user is already
 * authenticated: a session left open on an unattended device should not be
 * enough to lock its owner out of their own account.
 */
export async function changePassword(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false, error: "Session expire ho gaya. Dobara login karein." };
  }

  // The current-password check below is a password guess like any other,
  // so it needs the same protection as the login form.
  const limit = await checkRateLimitFor("passwordChange", user.email);
  if (!limit.allowed) {
    return { ok: false, error: rateLimitMessage(limit) };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (reauthError) {
    return { ok: false, error: "Current password galat hai." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("should be different")) {
      return { ok: false, error: "Naya password purane se alag hona chahiye." };
    }
    return { ok: false, error: "Password badal nahi paya. Dobara try karein." };
  }

  return { ok: true, message: "Password badal diya gaya." };
}

/**
 * Saves the path of a freshly uploaded avatar.
 *
 * The file itself goes straight from the browser to storage; this only
 * records where it landed.
 */
export async function setAvatar(
  avatarUrl: string | null,
): Promise<AuthFormState> {
  const parsed = z.string().url().max(500).nullable().safeParse(avatarUrl);

  if (!parsed.success) {
    return { ok: false, error: "Image save nahi ho payi." };
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
    .update({ avatar_url: parsed.data })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: "Image save nahi ho payi. Dobara try karein." };
  }

  revalidatePath("/app", "layout");
  return { ok: true, message: parsed.data ? "Photo update ho gayi." : "Photo hata di gayi." };
}
