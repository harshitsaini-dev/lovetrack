"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { AuthFormState } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/session";
import { getSignedUrlTtl } from "@/lib/settings/read";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  forbidden: "Aapke paas iski permission nahi hai.",
  not_found: "User nahi mila.",
  cannot_suspend_self: "Aap khud ko suspend nahi kar sakte.",
  cannot_suspend_admin:
    "Doosre admin ko suspend nahi kar sakte. Pehle unka admin role hatayein.",
};

export async function setUserStatus(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireAdmin();

  const parsed = z
    .object({
      userId: z.string().uuid(),
      status: z.enum(["active", "suspended"]),
      reason: z.string().max(300).optional(),
    })
    .safeParse({
      userId: formData.get("userId"),
      status: formData.get("status"),
      reason: formData.get("reason") ?? undefined,
    });

  if (!parsed.success) return { ok: false, error: "Galat request." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_user_status", {
    p_user_id: parsed.data.userId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) return { ok: false, error: "Change save nahi ho paya." };

  const result = data as { ok: boolean; error?: string };
  if (!result.ok) {
    return { ok: false, error: ERRORS[result.error ?? ""] ?? "Nahi ho paya." };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");

  return {
    ok: true,
    message:
      parsed.data.status === "suspended"
        ? "User suspend kar diya gaya."
        : "User wapas active kar diya gaya.",
  };
}

/**
 * Opens a piece of evidence for review.
 *
 * Two things happen, in this order: the view is written to the audit log,
 * then the URL is minted. If the logging fails, no URL is handed over —
 * looking at somebody's photograph without leaving a trace is exactly what
 * the audit log exists to prevent.
 */
export async function getEvidenceUrl(
  bucket: "attendance-media" | "lunch-proofs",
  path: string,
  targetUserId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();

  const parsed = z
    .object({
      bucket: z.enum(["attendance-media", "lunch-proofs"]),
      path: z.string().min(1).max(500),
      targetUserId: z.string().uuid(),
    })
    .safeParse({ bucket, path, targetUserId });

  if (!parsed.success) return { ok: false, error: "Galat request." };

  const supabase = await createClient();

  const { data: logged, error: logError } = await supabase.rpc(
    "admin_log_media_view",
    {
      p_target_user_id: parsed.data.targetUserId,
      p_kind: parsed.data.bucket,
      p_path: parsed.data.path,
    },
  );

  if (logError || !(logged as { ok: boolean } | null)?.ok) {
    return { ok: false, error: "Audit log nahi likha ja saka." };
  }

  const ttl = await getSignedUrlTtl();

  const { data, error } = await createAdminClient()
    .storage.from(parsed.data.bucket)
    .createSignedUrl(parsed.data.path, ttl);

  if (error || !data) return { ok: false, error: "File nahi mili." };

  return { ok: true, url: data.signedUrl };
}

const settingsSchema = z.object({
  maxAccuracyM: z.coerce.number().int().min(10).max(5000),
  warnAccuracyM: z.coerce.number().int().min(5).max(5000),
  maxFixAgeS: z.coerce.number().int().min(5).max(3600),
  maxSpeedKmh: z.coerce.number().int().min(50).max(5000),
  riskFlagThreshold: z.coerce.number().int().min(1).max(100),
  riskRejectThreshold: z.coerce.number().int().min(1).max(100),

  // Moved out of .env — product decisions, not deployment facts.
  nonceTtlSeconds: z.coerce.number().int().min(30).max(900),
  signedUrlTtlSeconds: z.coerce.number().int().min(30).max(3600),
  lunchMinSeconds: z.coerce.number().int().min(1).max(60),
  lunchMaxSeconds: z.coerce.number().int().min(1).max(120),
  lunchMaxBytes: z.coerce.number().int().min(100_000).max(52_428_800),

  pointsAccuracyLow: z.coerce.number().int().min(0).max(100),
  pointsZeroDrift: z.coerce.number().int().min(0).max(100),
  pointsImplausibleSpeed: z.coerce.number().int().min(0).max(100),
});

export async function updateRiskSettings(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireAdmin();

  const parsed = settingsSchema.safeParse({
    maxAccuracyM: formData.get("maxAccuracyM"),
    warnAccuracyM: formData.get("warnAccuracyM"),
    maxFixAgeS: formData.get("maxFixAgeS"),
    maxSpeedKmh: formData.get("maxSpeedKmh"),
    riskFlagThreshold: formData.get("riskFlagThreshold"),
    riskRejectThreshold: formData.get("riskRejectThreshold"),
    nonceTtlSeconds: formData.get("nonceTtlSeconds"),
    signedUrlTtlSeconds: formData.get("signedUrlTtlSeconds"),
    lunchMinSeconds: formData.get("lunchMinSeconds"),
    lunchMaxSeconds: formData.get("lunchMaxSeconds"),
    lunchMaxBytes: formData.get("lunchMaxBytes"),
    pointsAccuracyLow: formData.get("pointsAccuracyLow"),
    pointsZeroDrift: formData.get("pointsZeroDrift"),
    pointsImplausibleSpeed: formData.get("pointsImplausibleSpeed"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // A warning threshold above the rejection threshold would mean readings
  // are rejected before they can be warned about — the milder rule would
  // never fire.
  if (parsed.data.warnAccuracyM >= parsed.data.maxAccuracyM) {
    return {
      ok: false,
      error: "Warning accuracy, reject accuracy se kam honi chahiye.",
    };
  }

  if (parsed.data.riskFlagThreshold >= parsed.data.riskRejectThreshold) {
    return {
      ok: false,
      error: "Flag threshold, reject threshold se kam hona chahiye.",
    };
  }

  if (parsed.data.lunchMinSeconds >= parsed.data.lunchMaxSeconds) {
    return {
      ok: false,
      error: "Lunch video ka minimum, maximum se kam hona chahiye.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("system_settings")
    .update({
      max_accuracy_m: parsed.data.maxAccuracyM,
      warn_accuracy_m: parsed.data.warnAccuracyM,
      max_fix_age_s: parsed.data.maxFixAgeS,
      max_speed_kmh: parsed.data.maxSpeedKmh,
      risk_flag_threshold: parsed.data.riskFlagThreshold,
      risk_reject_threshold: parsed.data.riskRejectThreshold,
      nonce_ttl_seconds: parsed.data.nonceTtlSeconds,
      signed_url_ttl_seconds: parsed.data.signedUrlTtlSeconds,
      lunch_min_seconds: parsed.data.lunchMinSeconds,
      lunch_max_seconds: parsed.data.lunchMaxSeconds,
      lunch_max_bytes: parsed.data.lunchMaxBytes,
      points_accuracy_low: parsed.data.pointsAccuracyLow,
      points_zero_drift: parsed.data.pointsZeroDrift,
      points_implausible_speed: parsed.data.pointsImplausibleSpeed,
    })
    .eq("id", true);

  if (error) return { ok: false, error: "Settings save nahi ho payin." };

  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings save ho gayin. Change audit log me hai." };
}
