import { createClient } from "@/lib/supabase/client";
import type { AttendanceEventType } from "@/types/attendance";

export const ATTENDANCE_BUCKET = "attendance-media";

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

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const path = `users/${userId}/${year}/${month}/${eventType}-${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage
    .from(ATTENDANCE_BUCKET)
    .upload(path, blob, { contentType: "image/webp", upsert: false });

  // A failed upload must not block the check-in. The photo is one signal
  // among several; losing it is worth recording, not worth telling someone
  // their attendance did not count.
  if (error) return null;

  return path;
}
