import { createClient } from "@/lib/supabase/client";
import type { AttendanceEventType } from "@/types/attendance";

export const ATTENDANCE_BUCKET = "attendance-media";
export const LUNCH_BUCKET = "lunch-proofs";
export const AVATAR_BUCKET = "avatars";

function datedPath(userId: string, name: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `users/${userId}/${year}/${month}/${name}`;
}

/**
 * Uploads a captured frame straight from the browser.
 *
 * The bytes never pass through our server: the storage policy checks that
 * the path starts with the caller's own user id, so a client cannot write
 * into anyone else's folder even though it is talking to storage directly.
 */
export async function uploadAttendancePhoto(
  userId: string,
  eventType: AttendanceEventType,
  blob: Blob,
): Promise<string | null> {
  const supabase = createClient();
  const path = datedPath(userId, `${eventType}-${crypto.randomUUID()}.webp`);

  const { error } = await supabase.storage
    .from(ATTENDANCE_BUCKET)
    .upload(path, blob, { contentType: "image/webp", upsert: false });

  // A failed upload must not block the check-in. The photo is one signal
  // among several; losing it is worth recording, not worth telling someone
  // their attendance did not count.
  if (error) return null;

  return path;
}

/**
 * Uploads a profile picture and returns its public URL.
 *
 * Overwrites the previous one at a fixed path rather than accumulating
 * files, and appends a cache-busting query so the new face actually shows
 * up instead of the CDN serving the old one.
 *
 * Unlike attendance media, this is a normal photo — picking an existing
 * image is exactly what people expect here, so a file input is correct.
 */
export async function uploadAvatar(
  userId: string,
  blob: Blob,
  mimeType: string,
): Promise<string | null> {
  const supabase = createClient();

  const extension = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const path = `${userId}/avatar.${extension}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: mimeType, upsert: true });

  if (error) return null;

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  return `${publicUrl}?v=${Date.now()}`;
}

/**
 * Uploads a lunch proof clip.
 *
 * Unlike the check-in photo, this one IS the proof — so a failure here is
 * surfaced to the caller rather than swallowed.
 */
export async function uploadLunchProof(
  userId: string,
  blob: Blob,
  mimeType: string,
): Promise<string | null> {
  const supabase = createClient();

  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  const path = datedPath(userId, `lunch-${crypto.randomUUID()}.${extension}`);

  const { error } = await supabase.storage
    .from(LUNCH_BUCKET)
    // The recorder emits e.g. "video/webm;codecs=vp9,opus"; storage matches
    // its allowed types against the bare mime type.
    .upload(path, blob, {
      contentType: mimeType.split(";")[0],
      upsert: false,
    });

  if (error) return null;

  return path;
}
