import { getTodayInTimezone } from "@/lib/format/datetime";
import { createClient } from "@/lib/supabase/server";
import type {
  Attendance,
  AttendanceEvent,
  LunchProof,
  SystemSettings,
} from "@/types/attendance";

/**
 * Today's attendance for the signed-in user, in their own timezone.
 *
 * The date is derived from the user's profile timezone rather than the
 * server's, so someone in a different zone still gets their own "today".
 */
export async function getTodayAttendance(timezone: string): Promise<{
  attendance: Attendance | null;
  events: AttendanceEvent[];
  today: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = getTodayInTimezone(timezone);

  if (!user) return { attendance: null, events: [], today };

  const { data: attendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", user.id)
    .eq("attendance_date", today)
    .maybeSingle();

  if (!attendance) return { attendance: null, events: [], today };

  const { data: events } = await supabase
    .from("attendance_events")
    .select("*")
    .eq("attendance_id", attendance.id)
    .order("server_timestamp", { ascending: true });

  return { attendance, events: events ?? [], today };
}

/**
 * Recent days, newest first — the history screen.
 *
 * The range is inclusive on both ends, because that is what a person means
 * by "1st to 5th". attendance_date is a plain date, so these compare as
 * dates and no timezone gets involved.
 */
export async function getAttendanceHistory(
  { from, to, limit = 30 }: { from?: string; to?: string; limit?: number } = {},
): Promise<Attendance[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  let query = supabase
    .from("attendance")
    .select("*")
    .eq("user_id", user.id)
    .order("attendance_date", { ascending: false });

  if (from) query = query.gte("attendance_date", from);
  if (to) query = query.lte("attendance_date", to);

  // A filtered view should show everything in the range rather than the
  // most recent 30 of it, which would silently hide the older half of a
  // range somebody deliberately asked for.
  const { data } = await query.limit(from || to ? 400 : limit);

  return data ?? [];
}

export async function getEventsForAttendance(
  attendanceIds: string[],
): Promise<AttendanceEvent[]> {
  if (!attendanceIds.length) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_events")
    .select("*")
    .in("attendance_id", attendanceIds)
    .order("server_timestamp", { ascending: true });

  return data ?? [];
}

/**
 * Lunch clips for a set of days, so history can offer the video inline.
 *
 * Own rows only — RLS on lunch_proofs allows the owner, a partner who is
 * shared with, and an admin, and this call is always about yourself.
 */
export async function getLunchProofsForAttendance(
  attendanceIds: string[],
): Promise<LunchProof[]> {
  if (!attendanceIds.length) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("lunch_proofs")
    .select("*")
    .in("attendance_id", attendanceIds);

  return data ?? [];
}

export async function getSystemSettings(): Promise<SystemSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("system_settings").select("*").single();
  return data ?? null;
}
