"use server";

import { z } from "zod";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { LUNCH_MAX_SECONDS, LUNCH_MIN_SECONDS } from "@/lib/media/record";

const proofSchema = z.object({
  videoPath: z.string().min(1).max(500),
  // The recorder enforces these too, but the client is not the authority on
  // whether a clip is long enough to be worth anything.
  durationS: z.number().min(LUNCH_MIN_SECONDS).max(LUNCH_MAX_SECONDS + 2),
  sizeBytes: z.number().int().min(1).max(20 * 1024 * 1024),
  challengePhrase: z.string().max(100).nullable(),
});

export type LunchProofInput = z.infer<typeof proofSchema>;

export type LunchProofResult =
  | { ok: true; proofId: string }
  | { ok: false; error: string };

export async function recordLunchProof(
  input: LunchProofInput,
): Promise<LunchProofResult> {
  const parsed = proofSchema.safeParse(input);

  if (!parsed.success) {
    // A too-short clip is the common case here, and worth naming.
    const tooShort = parsed.error.issues.some(
      (issue) => issue.path[0] === "durationS",
    );
    return { ok: false, error: tooShort ? "clip_too_short" : "invalid_proof" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("record_lunch_proof", {
    p_video_path: parsed.data.videoPath,
    p_duration_s: parsed.data.durationS,
    p_size_bytes: parsed.data.sizeBytes,
    p_challenge_phrase: parsed.data.challengePhrase,
  });

  if (error) return { ok: false, error: "proof_save_failed" };

  const result = data as { ok: boolean; proof_id?: string; error?: string };

  return result.ok
    ? { ok: true, proofId: result.proof_id! }
    : { ok: false, error: result.error ?? "proof_save_failed" };
}

/**
 * Mints a short-lived URL for a lunch clip.
 *
 * Authorization happens here rather than in a storage policy, because a
 * partner's access depends on a sharing switch the storage layer knows
 * nothing about. The check is: you own it, or the owner shares lunch proof
 * with you, or you are an admin — anything else gets nothing.
 */
export async function getLunchProofUrl(
  proofId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(proofId);
  if (!parsed.success) return { ok: false, error: "invalid_request" };

  const supabase = await createClient();

  // RLS on lunch_proofs already encodes exactly that rule, so if this
  // returns a row the caller is allowed to watch the clip.
  const { data: proof } = await supabase
    .from("lunch_proofs")
    .select("video_path")
    .eq("id", parsed.data)
    .maybeSingle();

  if (!proof) return { ok: false, error: "not_found" };

  const ttl = Number(process.env.R2_SIGNED_URL_TTL_SECONDS ?? 300);

  // Signing happens with the service role deliberately. Storage policies
  // key off the owning user's path, and there is intentionally no policy
  // letting a partner read that folder — their permission lives in
  // pair_permissions, which storage cannot see. The row read above is the
  // authorization; this call is only the mechanics of handing it over.
  const { data, error } = await createAdminClient()
    .storage.from("lunch-proofs")
    .createSignedUrl(proof.video_path, ttl);

  if (error || !data) return { ok: false, error: "url_failed" };

  return { ok: true, url: data.signedUrl };
}
