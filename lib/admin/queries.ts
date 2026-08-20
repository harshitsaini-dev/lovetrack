import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type {
  AttendanceEventType,
  AttendanceStatus,
  AuditLog,
  RiskSignal,
  SystemSettings,
  VerificationStatus,
} from "@/types/attendance";
import type { AccountStatus, UserRole } from "@/types/database";

/**
 * Admin reads.
 *
 * Every one of these calls requireAdmin() first even though RLS enforces
 * the same rule. That is not belt-and-braces for security — RLS already has
 * that covered — it is so an unauthorised visitor gets the access-denied
 * page instead of a screen full of convincingly empty tables.
 */

export type AdminStats = {
  ok: true;
  users: number;
  suspended: number;
  pairs: number;
  checked_in_today: number;
  completed_today: number;
  on_leave_today: number;
  needs_review: number;
  emails_failed_7d: number;
};

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: AccountStatus;
  timezone: string;
  created_at: string;
  today_status: AttendanceStatus;
  flagged_30d: number;
};

export type FlaggedEvent = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  event_type: AttendanceEventType;
  server_timestamp: string;
  place_label: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  photo_path: string | null;
  device_label: string | null;
  risk_score: number;
  status: VerificationStatus;
  failure_reason: string | null;
  signals: RiskSignal[];
};

export type EmailLogRow = {
  id: string;
  user_id: string | null;
  template: string;
  to_email: string;
  subject: string | null;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  created_at: string;
};

export async function getAdminStats(): Promise<AdminStats | null> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_stats");

  const result = data as AdminStats | { ok: false } | null;
  return result && result.ok ? result : null;
}

export async function listUsers(
  search?: string,
  limit = 50,
): Promise<AdminUser[]> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_users", {
    p_search: search?.trim() || null,
    p_limit: limit,
  });

  return (data as AdminUser[] | null) ?? [];
}

export type AdminUserEvent = {
  id: string;
  attendance_id: string;
  event_type: AttendanceEventType;
  server_timestamp: string;
  status: VerificationStatus;
  risk_score: number | null;
  place_label: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  device_label: string | null;
  photo_path: string | null;
};

export type AdminUserDay = {
  id: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  lunch_started_at: string | null;
  lunch_verified_at: string | null;
  check_out_at: string | null;
};

export type AdminUserLunchProof = {
  id: string;
  attendance_id: string;
  created_at: string;
  duration_s: number | null;
};

/**
 * One user, for the record page.
 *
 * Reuses the searchable list rather than adding a second query, and then
 * matches on id — admin_list_users already applies is_admin() and returns
 * exactly the fields this page shows.
 */
export async function getAdminUser(userId: string): Promise<AdminUser | null> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_users", {
    p_search: null,
    p_limit: 500,
  });

  return (
    ((data as AdminUser[] | null) ?? []).find((u) => u.id === userId) ?? null
  );
}

export async function getAdminUserDays(
  userId: string,
  limit = 60,
): Promise<AdminUserDay[]> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_user_days", {
    p_user_id: userId,
    p_limit: limit,
  });

  return (data as AdminUserDay[] | null) ?? [];
}

export async function getAdminUserEvents(
  userId: string,
  limit = 200,
): Promise<AdminUserEvent[]> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_user_events", {
    p_user_id: userId,
    p_limit: limit,
  });

  return (data as AdminUserEvent[] | null) ?? [];
}

export async function getAdminUserLunchProofs(
  userId: string,
  limit = 60,
): Promise<AdminUserLunchProof[]> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_user_lunch_proofs", {
    p_user_id: userId,
    p_limit: limit,
  });

  return (data as AdminUserLunchProof[] | null) ?? [];
}

export async function listFlaggedEvents(limit = 50): Promise<FlaggedEvent[]> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_flagged_events", {
    p_limit: limit,
  });

  return (data as FlaggedEvent[] | null) ?? [];
}

export async function listAuditLog(limit = 100): Promise<AuditLog[]> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function listEmailLog(limit = 100): Promise<EmailLogRow[]> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("email_logs")
    .select("id, user_id, template, to_email, subject, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as EmailLogRow[] | null) ?? [];
}

export async function getSettings(): Promise<SystemSettings | null> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.from("system_settings").select("*").single();

  return data ?? null;
}
