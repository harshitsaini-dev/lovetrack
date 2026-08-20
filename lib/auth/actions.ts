"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAppUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * All form actions below take the `useActionState` shape:
 * (previousState, formData) => nextState
 */
export type AuthFormState = ActionResult | null;

/**
 * Supabase auth errors can leak whether an account exists. Map them to
 * deliberately vague, user-friendly Hinglish messages.
 */
function safeAuthError(message: string): string {
  const lowered = message.toLowerCase();

  if (lowered.includes("invalid login credentials")) {
    return "Email ya password galat hai";
  }
  if (lowered.includes("email not confirmed")) {
    return "Pehle apna email verify karein — inbox check karein";
  }
  if (lowered.includes("rate limit") || lowered.includes("too many")) {
    return "Bahut zyada koshishein. Thodi der baad try karein";
  }
  if (lowered.includes("already registered")) {
    return "Ye email pehle se registered hai";
  }
  if (lowered.includes("weak password")) {
    return "Password bahut kamzor hai";
  }
  return "Kuch galat ho gaya. Dobara try karein";
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { ok: false, error: safeAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function register(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { fullName, email, password } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // The trigger reads full_name out of raw_user_meta_data. Role is
      // deliberately NOT accepted here — it is never client-settable.
      data: { full_name: fullName },
      emailRedirectTo: `${getAppUrl()}/auth/confirm`,
    },
  });

  if (error) {
    return { ok: false, error: safeAuthError(error.message) };
  }

  return {
    ok: true,
    message: "Account ban gaya! Verification link aapke email par bheja hai.",
  };
}

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${getAppUrl()}/auth/confirm?next=/reset-password` },
  );

  // Never reveal whether the address exists — always report the same thing.
  if (error && !error.message.toLowerCase().includes("not found")) {
    return { ok: false, error: safeAuthError(error.message) };
  }

  return {
    ok: true,
    message:
      "Agar ye email registered hai, to reset link bhej diya gaya hai. Inbox check karein.",
  };
}

export async function resetPassword(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  // Only a valid recovery session can reach this point.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Reset link expire ho gaya hai. Naya link request karein.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: safeAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Password update ho gaya." };
}

export async function logout(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
