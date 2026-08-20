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

/** Recent days, newest first — the history screen. */
export async function getAttendanceHistory(limit = 30): Promise<Attendance[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", user.id)
    .order("attendance_date", { ascending: false })
    .limit(limit);

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
