"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type RetentionPreview = {
  ok: true;
  media_retention_days: number;
  record_retention_days: number;
  media_cutoff: string | null;
  record_cutoff: string | null;
  photos: number;
  clips: number;
  clip_bytes: number;
  attendance_rows: number;
};

export type RetentionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function previewCleanup(): Promise<RetentionPreview | null> {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_retention_cleanup");

  if (error || !data) return null;

  const result = data as RetentionPreview | { ok: false };
  return result.ok ? result : null;
}

const settingsSchema = z.object({
  mediaRetentionDays: z.coerce.number().int().min(0).max(3650),
  recordRetentionDays: z.coerce.number().int().min(0).max(3650),
});

export async function updateRetentionSettings(
  _prev: RetentionResult | null,
  formData: FormData,
): Promise<RetentionResult> {
  await requireAdmin();

  const parsed = settingsSchema.safeParse({
    mediaRetentionDays: formData.get("mediaRetentionDays"),
    recordRetentionDays: formData.get("recordRetentionDays"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Value 0 se 3650 din ke beech honi chahiye." };
  }

  // Keeping media longer than the records themselves would orphan files
  // nothing points at — the exact thing this feature exists to prevent.
  if (
    parsed.data.recordRetentionDays > 0 &&
    parsed.data.mediaRetentionDays > parsed.data.recordRetentionDays
  ) {
    return {
      ok: false,
      error:
        "Media retention record retention se zyada nahi ho sakti, warna files bina record ke reh jayengi.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("system_settings")
    .update({
      media_retention_days: parsed.data.mediaRetentionDays,
      record_retention_days: parsed.data.recordRetentionDays,
    })
    .eq("id", true);

  if (error) return { ok: false, error: "Settings save nahi ho payin." };

  revalidatePath("/admin/storage");
  return { ok: true, message: "Retention settings save ho gayin." };
}

/**
 * Deletes expired media, then clears the rows that referenced it.
 *
 * Order matters. Objects go first: if the run dies halfway, what is left
 * is rows pointing at missing files, which the next run cleans up. Doing
 * it the other way round would lose the paths and orphan the files
 * forever — invisible, unreferenced, and still counting against the quota.
 */
export async function runCleanup(): Promise<RetentionResult> {
  await requireAdmin();

  const supabase = await createClient();

  const { data: expired, error: listError } = await supabase.rpc(
    "list_expired_media",
  );

  if (listError) {
    return { ok: false, error: "Purani files list nahi ho payin." };
  }

  const objects = (expired ?? []) as { bucket: string; path: string }[];

  // Storage removal needs the service role: users may not delete evidence,
  // and an admin has no storage policy granting it either.
  const admin = createAdminClient();

  const byBucket = new Map<string, string[]>();
  for (const { bucket, path } of objects) {
    if (!path) continue;
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]);
  }

  let removed = 0;

  for (const [bucket, paths] of byBucket) {
    // Supabase caps a remove() call; chunk so a large backlog still clears.
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await admin.storage.from(bucket).remove(chunk);
      if (!error) removed += chunk.length;
    }
  }

  const { data, error } = await supabase.rpc("apply_retention_cleanup");

  if (error || !data) {
    return { ok: false, error: "Cleanup poora nahi ho paya." };
  }

  const result = data as {
    ok: boolean;
    photos_cleared: number;
    clips_deleted: number;
    attendance_rows_deleted: number;
  };

  if (!result.ok) return { ok: false, error: "Cleanup allowed nahi hai." };

  revalidatePath("/admin/storage");

  return {
    ok: true,
    message:
      `${removed} files delete huin · ${result.photos_cleared} photos clear · ` +
      `${result.clips_deleted} lunch clips hate · ` +
      `${result.attendance_rows_deleted} attendance records hate`,
  };
}
