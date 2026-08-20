import { createClient } from "@/lib/supabase/server";

/**
 * Leave is information, not a request: the user states they are off, and
 * that is the whole transaction. Two states — it stands, or it was
 * withdrawn because it was entered by mistake.
 */
export type LeaveEntry = {
  id: string;
  user_id: string;
  leave_date: string;
  leave_type: "casual" | "sick" | "personal" | "holiday";
  reason: string;
  status: "recorded" | "cancelled";
  created_at: string;
  updated_at: string;
};

export async function getMyLeave(limit = 30): Promise<LeaveEntry[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("leave_date", { ascending: false })
    .limit(limit);

  return data ?? [];
}

/** Today's leave, if any — the dashboard uses it to explain a quiet day. */
export async function getLeaveForDate(
  date: string,
): Promise<LeaveEntry | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("user_id", user.id)
    .eq("leave_date", date)
    .eq("status", "recorded")
    .maybeSingle();

  return data ?? null;
}
