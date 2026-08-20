import { createClient } from "@/lib/supabase/server";
import type { LunchProof } from "@/types/attendance";

export async function getTodayLunchProof(
  attendanceId: string,
): Promise<LunchProof | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("lunch_proofs")
    .select("*")
    .eq("attendance_id", attendanceId)
    .maybeSingle();

  return data ?? null;
}

/** Proofs for a set of days — used by history and the partner view. */
export async function getLunchProofs(
  attendanceIds: string[],
): Promise<LunchProof[]> {
  if (!attendanceIds.length) return [];

  const supabase = await createClient();

  // RLS decides what comes back: your own always, a partner's only where
  // they have turned lunch proof sharing on.
  const { data } = await supabase
    .from("lunch_proofs")
    .select("*")
    .in("attendance_id", attendanceIds);

  return data ?? [];
}
