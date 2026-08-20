"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { AuthFormState } from "@/lib/auth/actions";
import {
  checkRateLimitFor,
  rateLimitMessage,
} from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type {
  PairingRequestResult,
  PairPermissionsUpdate,
} from "@/types/database";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email daalna zaroori hai")
  .email("Sahi email address daalein")
  .toLowerCase();

const pairIdSchema = z.string().uuid();

const permissionKeys = [
  "share_attendance",
  "share_location",
  "share_lunch_proof",
  "share_leave",
] as const;

const permissionSchema = z.enum(permissionKeys);

/**
 * Sends a pairing request by email.
 *
 * The lookup happens inside a SECURITY DEFINER function so the client never
 * queries profiles by email, and an unknown address returns the same
 * "request sent" as a real one — otherwise this would be an account
 * enumeration endpoint.
 */
export async function sendPairingRequest(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // This is the account-enumeration surface. The reply is identical for a
  // registered and an unknown address, so volume is the only thing left to
  // learn from — and this closes that.
  const limit = await checkRateLimitFor("pairingRequest", parsed.data);

  if (!limit.allowed) {
    return { ok: false, error: rateLimitMessage(limit) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_pairing", {
    target_email: parsed.data,
  });

  if (error) {
    return { ok: false, error: "Request bhej nahi paye. Dobara try karein." };
  }

  const result = data as PairingRequestResult;

  if (result === "self") {
    return { ok: false, error: "Aap khud ke saath pair nahi kar sakte." };
  }
  if (result === "exists") {
    return {
      ok: false,
      error: "Is user ke saath pehle se ek request ya pairing active hai.",
    };
  }
  if (result === "unauthenticated") {
    return { ok: false, error: "Session expire ho gaya. Dobara login karein." };
  }

  revalidatePath("/app/partner");
  return {
    ok: true,
    message:
      "Agar ye email LoveTrack par registered hai, to request bhej di gayi hai.",
  };
}

/** The receiver accepts a pending invite. */
export async function acceptPairing(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = pairIdSchema.safeParse(formData.get("pairId"));
  if (!parsed.success) return { ok: false, error: "Galat request." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pairs")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", parsed.data);

  if (error) {
    return { ok: false, error: "Accept nahi ho paya. Dobara try karein." };
  }

  revalidatePath("/app/partner");
  return {
    ok: true,
    message:
      "Pairing ho gayi. Ab chunein ki aap kya share karna chahte hain — by default sirf attendance share hoti hai.",
  };
}

/** The receiver declines a pending invite. */
export async function rejectPairing(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = pairIdSchema.safeParse(formData.get("pairId"));
  if (!parsed.success) return { ok: false, error: "Galat request." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pairs")
    .update({ status: "rejected", responded_at: new Date().toISOString() })
    .eq("id", parsed.data);

  if (error) {
    return { ok: false, error: "Reject nahi ho paya. Dobara try karein." };
  }

  revalidatePath("/app/partner");
  return { ok: true, message: "Request decline kar di gayi." };
}

/**
 * Ends a pairing, or withdraws an invite that was never answered.
 *
 * Either member can do this at any time — that is the point. RLS enforces
 * that the caller is actually part of the pair.
 */
export async function revokePairing(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = pairIdSchema.safeParse(formData.get("pairId"));
  if (!parsed.success) return { ok: false, error: "Galat request." };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Session expire ho gaya. Dobara login karein." };
  }

  const { error } = await supabase
    .from("pairs")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
    })
    .eq("id", parsed.data);

  if (error) {
    return { ok: false, error: "Pairing hata nahi paye. Dobara try karein." };
  }

  revalidatePath("/app/partner");
  return { ok: true, message: "Pairing hata di gayi. Sharing turant band ho gayi." };
}

/**
 * Flips one sharing permission on the caller's own row.
 *
 * RLS restricts updates to rows where `owner_id = auth.uid()`, so a user
 * cannot change what their partner shares even if they forge the pair id.
 */
export async function setSharePermission(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const pairId = pairIdSchema.safeParse(formData.get("pairId"));
  const key = permissionSchema.safeParse(formData.get("permission"));
  const enabled = formData.get("enabled") === "true";

  if (!pairId.success || !key.success) {
    return { ok: false, error: "Galat request." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Session expire ho gaya. Dobara login karein." };
  }

  // Assigning through a typed object keeps the key a literal union; an
  // inline computed key would widen to Record<string, boolean> and lose
  // the compile-time guarantee that only these four columns are writable.
  const update: PairPermissionsUpdate = {};
  update[key.data] = enabled;

  const { error } = await supabase
    .from("pair_permissions")
    .update(update)
    .eq("pair_id", pairId.data)
    .eq("owner_id", user.id);

  if (error) {
    return { ok: false, error: "Setting badal nahi payi. Dobara try karein." };
  }

  revalidatePath("/app/partner");
  return { ok: true };
}

/** Turns off every sharing switch at once — the panic button. */
export async function stopAllSharing(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const pairId = pairIdSchema.safeParse(formData.get("pairId"));
  if (!pairId.success) return { ok: false, error: "Galat request." };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Session expire ho gaya. Dobara login karein." };
  }

  const { error } = await supabase
    .from("pair_permissions")
    .update({
      share_attendance: false,
      share_location: false,
      share_lunch_proof: false,
      share_leave: false,
    })
    .eq("pair_id", pairId.data)
    .eq("owner_id", user.id);

  if (error) {
    return { ok: false, error: "Sharing band nahi ho payi. Dobara try karein." };
  }

  revalidatePath("/app/partner");
  return { ok: true, message: "Sab sharing band kar di gayi." };
}
