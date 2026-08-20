export type AttendanceEventType =
  | "check_in"
  | "check_out"
  | "lunch_start"
  | "lunch_end";

export type VerificationStatus = "passed" | "flagged" | "rejected";

export type AttendanceStatus =
  | "not_started"
  | "checked_in"
  | "lunch_active"
  | "lunch_verified"
  | "checked_out";

export type Attendance = {
  id: string;
  user_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  lunch_started_at: string | null;
  lunch_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceEvent = {
  id: string;
  attendance_id: string;
  user_id: string;
  event_type: AttendanceEventType;
  server_timestamp: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  fix_age_s: number | null;
  place_label: string | null;
  photo_path: string | null;
  nonce_id: string | null;
  device_label: string | null;
  ip_hash: string | null;
  risk_score: number;
  status: VerificationStatus;
  failure_reason: string | null;
  created_at: string;
};

export type RiskSignal = {
  signal: string;
  points: number;
  detail?: string;
};

/** What `record_attendance_event` returns. */
export type RecordEventResult =
  | {
      ok: true;
      event_id: string;
      status: VerificationStatus;
      risk_score: number;
      reason: string | null;
      server_time: string;
      signals: RiskSignal[];
    }
  | { ok: false; error: string; status?: VerificationStatus; risk_score?: number; signals?: RiskSignal[] };

export type LunchProof = {
  id: string;
  attendance_id: string;
  user_id: string;
  event_id: string | null;
  video_path: string;
  duration_s: number | null;
  size_bytes: number | null;
  challenge_phrase: string | null;
  created_at: string;
};

export type SystemSettings = {
  id: boolean;
  max_accuracy_m: number;
  warn_accuracy_m: number;
  max_fix_age_s: number;
  max_speed_kmh: number;
  risk_flag_threshold: number;
  risk_reject_threshold: number;
  allow_checkout_without_checkin: boolean;
  points_accuracy_low: number;
  points_zero_drift: number;
  points_implausible_speed: number;
  /** Age at which photos and clips are purged; 0 disables. */
  media_retention_days: number;
  /** Age at which whole attendance rows go; 0 keeps them forever. */
  record_retention_days: number;

  /** Seconds a capture nonce stays valid. */
  nonce_ttl_seconds: number;
  lunch_min_seconds: number;
  lunch_max_seconds: number;
  lunch_max_bytes: number;
  /** Seconds a signed media URL lives — the link is the access. */
  signed_url_ttl_seconds: number;
  reminder_grace_minutes: number;

  updated_at: string;
};

/** The subset a signed-in client may read: the rules, not the keys. */
export type PublicSettings = {
  lunch_min_seconds: number;
  lunch_max_seconds: number;
  lunch_max_bytes: number;
  max_accuracy_m: number;
  warn_accuracy_m: number;
  max_fix_age_s: number;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  target_user_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};
