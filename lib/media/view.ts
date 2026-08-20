"use server";

import { z } from "zod";

import { getSignedUrlTtl } from "@/lib/settings/read";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Opening a photo or a lunch clip.
 *
 * Three kinds of viewer reach this code — the owner, a paired partner, and
 * an admin — and each is allowed for a different reason. Working that out
 * in a component would mean three places to get it wrong, so the database
 * decides: `get_*_access` returns the storage path only to someone entitled
 * to it, and says whether the viewer got there as an admin.
 *
 * The signed URL itself is minted with the service role. Storage policies
 * key off the owner's folder and there is deliberately no policy letting a
 * partner read it — their permission lives in `pair_permissions`, which
 * storage cannot see. The access check above is the authorization; this is
 * only the mechanics of handing the file over.
 */

export type MediaUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

type Access = {
  ok: boolean;
  reason?: string;
  path?: string;
  owner_id?: string;
  as_admin?: boolean;
};

const BUCKETS = {
  photo: "attendance-media",
  lunch: "lunch-proofs",
} as const;

/**
 * Deliberately vague, and identical for "does not exist" and "not shared
 * with you". Distinguishing them would turn this into a way to find out
 * what somebody has recorded.
 */
const REFUSED = "Ye media aapke liye available nahi hai.";

async function resolve(
  kind: "photo" | "lunch",
  id: string,
): Promise<MediaUrlResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: REFUSED };

  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    kind === "photo" ? "get_attendance_photo_access" : "get_lunch_proof_access",
    kind === "photo"
      ? { p_event_id: parsed.data }
      : { p_proof_id: parsed.data },
  );

  const access = (data ?? null) as Access | null;

  if (error || !access?.ok || !access.path) {
    return { ok: false, error: REFUSED };
  }

  // An admin looking at somebody else's face is exactly what the audit log
  // exists for. The log is written BEFORE the URL is minted: if it cannot
  // be recorded, the view does not happen. A silent look is worse than a
  // refused one.
  if (access.as_admin && access.owner_id) {
    const { data: logged, error: logError } = await supabase.rpc(
      "admin_log_media_view",
      {
        p_target_user_id: access.owner_id,
        p_kind: BUCKETS[kind],
        p_path: access.path,
      },
    );

    if (logError || !(logged as { ok: boolean } | null)?.ok) {
      return { ok: false, error: "Audit log nahi likha ja saka." };
    }
  }

  const { data: signed, error: signError } = await createAdminClient()
    .storage.from(BUCKETS[kind])
    .createSignedUrl(access.path, await getSignedUrlTtl());

  if (signError || !signed) return { ok: false, error: "File nahi mili." };

  return { ok: true, url: signed.signedUrl };
}

/** A check-in / check-out / lunch photo, by its attendance event id. */
export async function getAttendancePhotoUrl(
  eventId: string,
): Promise<MediaUrlResult> {
  return resolve("photo", eventId);
}

/** A lunch verification clip, by its proof id. */
export async function getLunchVideoUrl(
  proofId: string,
): Promise<MediaUrlResult> {
  return resolve("lunch", proofId);
}
