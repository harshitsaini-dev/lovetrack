/**
 * Hand-maintained database types.
 *
 * The shape here must match what `supabase gen types` produces, because
 * supabase-js uses it to infer query results. Once the schema settles,
 * regenerate instead of editing by hand:
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 */

import type {
  Attendance,
  AttendanceEvent,
  AttendanceEventType,
  AuditLog,
  LunchProof,
  SystemSettings,
} from "@/types/attendance";
import type { LeaveEntry } from "@/lib/leave/queries";

export type UserRole = "user" | "admin";
export type AccountStatus = "active" | "suspended";
export type PairStatus = "pending" | "accepted" | "rejected" | "revoked";

/** What one user has chosen to share with their partner. */
export type SharePermission =
  | "attendance"
  | "location"
  | "lunch_proof"
  | "leave";

// Declared as a `type`, not an `interface`, on purpose: supabase-js requires
// each Row to satisfy Record<string, unknown>, and interfaces do not get an
// implicit index signature — using one silently breaks query type inference.
export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: AccountStatus;
  notify_check_in: boolean;
  notify_lunch: boolean;
  notify_check_out: boolean;
  notify_leave: boolean;
  notify_reminder: boolean;
  /** Local "HH:MM:SS" for the daily reminder, read in `timezone`. */
  reminder_time: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

/** Columns a user is allowed to change on their own profile. */
export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "full_name"
    | "avatar_url"
    | "notify_check_in"
    | "notify_lunch"
    | "notify_check_out"
    | "notify_leave"
    | "notify_reminder"
    | "reminder_time"
    | "timezone"
  >
>;

export type Pair = {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: PairStatus;
  created_at: string;
  responded_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
};

export type PairPermissions = {
  id: string;
  pair_id: string;
  /** The user doing the sharing — only they may change this row. */
  owner_id: string;
  share_attendance: boolean;
  share_location: boolean;
  share_lunch_proof: boolean;
  share_leave: boolean;
  /** Check-in / check-out photographs. */
  share_photos: boolean;
  created_at: string;
  updated_at: string;
};

export type PairPermissionsUpdate = Partial<
  Pick<
    PairPermissions,
    | "share_attendance"
    | "share_location"
    | "share_lunch_proof"
    | "share_leave"
    | "share_photos"
  >
>;

/** Result codes from the `request_pairing` database function. */
export type PairingRequestResult =
  | "sent"
  | "exists"
  | "self"
  | "unauthenticated";

export type Database = {
  public: {
    Tables: {
      attendance: {
        Row: Attendance;
        // Rows are written only by record_attendance_event(); there is no
        // INSERT/UPDATE policy, so these exist purely to satisfy the client
        // type and are never used.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      attendance_events: {
        Row: AttendanceEvent;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      attendance_nonces: {
        Row: {
          id: string;
          user_id: string;
          event_type: AttendanceEventType;
          created_at: string;
          expires_at: string;
          used_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      leave_requests: {
        Row: LeaveEntry;
        Insert: Pick<LeaveEntry, "user_id" | "leave_date" | "reason"> &
          Partial<Pick<LeaveEntry, "leave_type">>;
        // Withdrawing is the only change anyone may make.
        Update: Pick<LeaveEntry, "status">;
        Relationships: [];
      };
      email_logs: {
        Row: {
          id: string;
          user_id: string | null;
          template: string;
          to_email: string;
          subject: string | null;
          status: "sent" | "failed" | "skipped";
          provider_id: string | null;
          error: string | null;
          dedup_key: string | null;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          template: string;
          to_email: string;
          subject?: string | null;
          status: "sent" | "failed" | "skipped";
          provider_id?: string | null;
          error?: string | null;
          dedup_key?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      lunch_proofs: {
        Row: LunchProof;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      risk_events: {
        Row: {
          id: string;
          user_id: string;
          attendance_event_id: string | null;
          signal: string;
          detail: string | null;
          points: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      system_settings: {
        Row: SystemSettings;
        Insert: never;
        Update: Partial<Omit<SystemSettings, "id" | "updated_at">>;
        Relationships: [];
      };
      pairs: {
        Row: Pair;
        Insert: Pick<Pair, "requester_id" | "receiver_id"> & Partial<Pair>;
        Update: Partial<
          Pick<Pair, "status" | "responded_at" | "revoked_at" | "revoked_by">
        >;
        Relationships: [];
      };
      pair_permissions: {
        Row: PairPermissions;
        Insert: Pick<PairPermissions, "pair_id" | "owner_id"> &
          Partial<PairPermissions>;
        Update: PairPermissionsUpdate;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Pick<Profile, "id" | "email"> &
          Partial<Omit<Profile, "id" | "email">>;
        Update: ProfileUpdate;
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: {
        Args: { check_user_id?: string };
        Returns: boolean;
      };
      is_paired_with: {
        Args: { other_user_id: string };
        Returns: boolean;
      };
      can_view_shared: {
        Args: {
          owner_user_id: string;
          permission: string;
          viewer_id?: string;
        };
        Returns: boolean;
      };
      request_pairing: {
        Args: { target_email: string };
        Returns: string;
      };
      get_pair_partners: {
        Args: Record<string, never>;
        Returns: {
          pair_id: string;
          partner_id: string;
          full_name: string | null;
          email: string;
          avatar_url: string | null;
        }[];
      };
      issue_attendance_nonce: {
        Args: { p_event_type: AttendanceEventType };
        Returns: string;
      };
      check_rate_limit: {
        Args: {
          p_bucket: string;
          p_max_attempts: number;
          p_window_seconds: number;
        };
        Returns: unknown;
      };
      get_public_settings: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      admin_stats: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      admin_list_users: {
        Args: { p_search?: string | null; p_limit?: number };
        Returns: unknown[];
      };
      admin_set_user_status: {
        Args: {
          p_user_id: string;
          p_status: AccountStatus;
          p_reason?: string | null;
        };
        Returns: unknown;
      };
      admin_flagged_events: {
        Args: { p_limit?: number };
        Returns: unknown[];
      };
      admin_log_media_view: {
        Args: { p_target_user_id: string; p_kind: string; p_path: string };
        Returns: unknown;
      };
      get_partner_permissions: {
        Args: { p_partner_id: string };
        Returns: unknown;
      };
      get_partner_days: {
        Args: { p_partner_id: string; p_limit?: number };
        Returns: unknown[];
      };
      get_partner_events: {
        Args: { p_partner_id: string; p_from_date?: string | null };
        Returns: unknown[];
      };
      get_partner_lunch_proofs: {
        Args: { p_partner_id: string; p_from_date?: string | null };
        Returns: unknown[];
      };
      get_attendance_photo_access: {
        Args: { p_event_id: string };
        Returns: unknown;
      };
      get_lunch_proof_access: {
        Args: { p_proof_id: string };
        Returns: unknown;
      };
      admin_user_days: {
        Args: { p_user_id: string; p_limit?: number };
        Returns: unknown[];
      };
      admin_user_events: {
        Args: { p_user_id: string; p_limit?: number };
        Returns: unknown[];
      };
      admin_delete_attendance_event: {
        Args: { p_event_id: string; p_reason: string };
        Returns: unknown;
      };
      admin_delete_attendance_day: {
        Args: { p_attendance_id: string; p_reason: string };
        Returns: unknown;
      };
      lunch_proof_exists: {
        Args: { p_attendance_id: string };
        Returns: boolean;
      };
      admin_user_lunch_proofs: {
        Args: { p_user_id: string; p_limit?: number };
        Returns: unknown[];
      };
      users_due_for_reminder: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string;
          full_name: string | null;
          timezone: string;
          local_date: string;
          attendance_status: string;
        }[];
      };
      preview_retention_cleanup: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      list_expired_media: {
        Args: Record<string, never>;
        Returns: { bucket: string; path: string }[];
      };
      apply_retention_cleanup: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      record_lunch_proof: {
        Args: {
          p_video_path: string;
          p_duration_s: number;
          p_size_bytes: number;
          p_challenge_phrase?: string | null;
        };
        Returns: unknown;
      };
      record_attendance_event: {
        Args: {
          p_nonce: string;
          p_event_type: AttendanceEventType;
          p_latitude: number;
          p_longitude: number;
          p_accuracy_m: number;
          p_fix_age_s: number;
          p_photo_path?: string | null;
          p_place_label?: string | null;
          p_device_label?: string | null;
          p_ip_hash?: string | null;
        };
        Returns: unknown;
      };
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
      pair_status: PairStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};
