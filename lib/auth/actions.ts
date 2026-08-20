"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  REMEMBER_COOKIE,
  rememberCookieOptions,
} from "@/lib/auth/remember";
import {
  passwordResetCodeEmail,
  verificationCodeEmail,
} from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import {
  checkRateLimitFor,
  rateLimitMessage,
} from "@/lib/security/rate-limit";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendCodeSchema,
  resetPasswordSchema,
  verifyCodeSchema,
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

  // Counted before the attempt, not after: a check that only runs on
  // failure can be sidestepped by an attacker who guesses correctly.
  const limit = await checkRateLimitFor("login", parsed.data.email);

  if (!limit.allowed) {
    return { ok: false, error: rateLimitMessage(limit) };
  }

  // Recorded before signing in, because the sign-in is what writes the auth
  // cookies — and they need to already know whether to persist.
  const remember = formData.get("remember") === "on";
  const cookieStore = await cookies();
  cookieStore.set(
    REMEMBER_COOKIE,
    remember ? "1" : "0",
    rememberCookieOptions(remember),
  );

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { ok: false, error: safeAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * How long an emailed code stays usable, for the wording in the email.
 * Supabase's own OTP expiry is the thing that actually enforces it; this is
 * only what we tell the reader, kept in one place so the two do not drift
 * apart silently.
 */
const CODE_MINUTES = 60;

/**
 * Mints a verification code and delivers it through our own Resend
 * templates.
 *
 * `generateLink` is the one admin call that returns a code without sending
 * anything, which is exactly what we want: Supabase's built-in mailer never
 * touches a LoveTrack user. Every code therefore arrives from our verified
 * domain, in our template, and is written to `email_logs` like all other
 * mail — so a delivery that failed is answerable instead of invisible.
 */
async function sendCode(
  email: string,
  mode: "signup" | "recovery",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    // For an account that already exists, a magiclink code both signs the
    // person in and marks the address confirmed — which is what signup
    // verification needs to accomplish.
    type: mode === "signup" ? "magiclink" : "recovery",
    email,
  });

  const code = data?.properties?.email_otp;

  if (error || !code) {
    return { ok: false, error: "Code bhejne me dikkat hui. Dobara try karein" };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("email", email)
    .maybeSingle();

  const content =
    mode === "signup"
      ? verificationCodeEmail(profile?.full_name ?? null, code, CODE_MINUTES)
      : passwordResetCodeEmail(profile?.full_name ?? null, code, CODE_MINUTES);

  const sent = await sendEmail({
    to: email,
    userId: profile?.id ?? null,
    template: mode === "signup" ? "verification_code" : "password_reset_code",
    // No dedup key: asking for a fresh code is a legitimate thing to do
    // more than once, and the rate limiter is what bounds it.
    ...content,
  });

  if (!sent.ok && sent.reason === "failed") {
    return { ok: false, error: "Email bhej nahi paaye. Thodi der baad try karein" };
  }

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

  const limit = await checkRateLimitFor("register", email);
  if (!limit.allowed) {
    return { ok: false, error: rateLimitMessage(limit) };
  }

  // Created through the admin API rather than `signUp`, because `signUp`
  // always sends Supabase's own email — the one thing this flow exists to
  // avoid. `email_confirm: false` keeps the account unusable until a code
  // is redeemed; an unconfirmed account cannot sign in with its password.
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    // The trigger reads full_name out of raw_user_meta_data. Role is
    // deliberately NOT accepted here — it is never client-settable.
    user_metadata: { full_name: fullName },
  });

  if (error) {
    return { ok: false, error: safeAuthError(error.message) };
  }

  const sent = await sendCode(email, "signup");

  if (!sent.ok) {
    // The account exists but the code did not arrive. Say so plainly rather
    // than moving them to a screen that waits for mail that is never
    // coming; the resend on that screen would hit the same failure.
    return { ok: false, error: sent.error };
  }

  // Redirected from the server, not from an effect in the form. React
  // resets an uncontrolled form once its action resolves, so by the time a
  // client effect runs the email input is already empty — the redirect
  // would carry no address and /verify would bounce to /login.
  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

/**
 * Redeems an emailed code.
 *
 * For signup this confirms the address and signs the person in. For
 * recovery it opens the short-lived session that `/reset-password` needs.
 */
export async function verifyCode(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = verifyCodeSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    mode: formData.get("mode") ?? "signup",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { email, code, mode } = parsed.data;

  // Counted before the attempt. An eight-digit code is only safe because
  // guessing is bounded — without this the code is the weak point, not the
  // password.
  const limit = await checkRateLimitFor("otpVerify", email);
  if (!limit.allowed) {
    return { ok: false, error: rateLimitMessage(limit) };
  }

  const supabase = await createClient();

  // `mode` decides where to send them afterwards, and nothing else.
  // Supabase accepts the `email` and `recovery` OTP types interchangeably,
  // so this value must never be treated as a permission — it comes from a
  // query string. What actually authorises anything is possession of a
  // single-use code that was emailed to this address.
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: mode === "signup" ? "email" : "recovery",
  });

  if (error) {
    return {
      ok: false,
      error: "Code galat hai ya expire ho gaya. Naya code mangwa lein",
    };
  }

  revalidatePath("/", "layout");

  // Signup lands on the dashboard already signed in; recovery opens the
  // short-lived session that /reset-password requires.
  redirect(mode === "signup" ? "/app/dashboard" : "/reset-password");
}

/** Sends a fresh code, for when the first one never arrived or expired. */
export async function resendCode(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resendCodeSchema.safeParse({
    email: formData.get("email"),
    mode: formData.get("mode") ?? "signup",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const limit = await checkRateLimitFor("otpResend", parsed.data.email);
  if (!limit.allowed) {
    return { ok: false, error: rateLimitMessage(limit) };
  }

  await sendCode(parsed.data.email, parsed.data.mode);

  // Deliberately the same reply whether or not that succeeded. Whether an
  // address has an account is not something a resend button should be able
  // to answer, and a failure here is already recorded in `email_logs`.
  return { ok: true, message: "Naya code bhej diya. Inbox check karein." };
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

  const limit = await checkRateLimitFor("passwordReset", parsed.data.email);

  if (!limit.allowed) {
    // Deliberately the same vague wording as the success case would use
    // for an unknown address — the limit must not become a way to learn
    // which addresses exist.
    return { ok: false, error: rateLimitMessage(limit) };
  }

  // Result ignored on purpose: an unknown address must produce exactly the
  // same screen as a known one, so the form cannot be used to find out who
  // has an account here. An address with no account simply never receives
  // a code, and the same code screen appears either way.
  await sendCode(parsed.data.email, "recovery");

  redirect(
    `/verify?mode=recovery&email=${encodeURIComponent(parsed.data.email)}`,
  );
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
