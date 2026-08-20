import { createClient } from "@/lib/supabase/server";
import type { AttendanceEventType, AttendanceStatus } from "@/types/attendance";
import type { LeaveEntry } from "@/lib/leave/queries";

/**
 * What a partner is allowed to see, and what they actually see.
 *
 * Everything here goes through database functions rather than direct table
 * reads. Row-level security cannot express "you may see this row but not
 * its latitude", and that distinction is the entire point of the location
 * switch — so the gating lives in SQL, where it cannot be forgotten.
 */

export type PartnerPermissions = {
  attendance: boolean;
  location: boolean;
  lunch_proof: boolean;
  leave: boolean;
};

export type PartnerDay = {
  id: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  lunch_started_at: string | null;
  lunch_verified_at: string | null;
  check_out_at: string | null;
};

export type PartnerEvent = {
  id: string;
  attendance_id: string;
  event_type: AttendanceEventType;
  server_timestamp: string;
  place_label: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  /** False when the partner has attendance shared but not location. */
  location_shared: boolean;
};

export async function getPartnerPermissions(
  partnerId: string,
): Promise<PartnerPermissions> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_partner_permissions", {
    p_partner_id: partnerId,
  });

  return (
    (data as PartnerPermissions | null) ?? {
      attendance: false,
      location: false,
      lunch_proof: false,
      leave: false,
    }
  );
}

export async function getPartnerDays(
  partnerId: string,
  limit = 30,
): Promise<PartnerDay[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_partner_days", {
    p_partner_id: partnerId,
    p_limit: limit,
  });

  return (data as PartnerDay[] | null) ?? [];
}

export async function getPartnerEvents(
  partnerId: string,
  fromDate?: string,
): Promise<PartnerEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_partner_events", {
    p_partner_id: partnerId,
    p_from_date: fromDate ?? null,
  });

  return (data as PartnerEvent[] | null) ?? [];
}

/** Leave the partner has chosen to share. RLS handles the gating. */
export async function getPartnerLeave(
  partnerId: string,
  limit = 10,
): Promise<LeaveEntry[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("user_id", partnerId)
    .eq("status", "recorded")
    .order("leave_date", { ascending: false })
    .limit(limit);

  return data ?? [];
}
