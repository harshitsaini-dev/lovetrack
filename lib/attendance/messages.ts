import type { AttendanceEventType, RiskSignal } from "@/types/attendance";

/**
 * Every failure the verification function can return, phrased so the user
 * knows what to actually do next. A bare "verification failed" leaves
 * someone standing in a corridor with no idea whether to move or retry.
 */
const ERRORS: Record<string, string> = {
  not_authenticated: "Session expire ho gaya. Dobara login karein.",
  account_suspended: "Aapka account suspend hai.",

  invalid_nonce: "Ye request valid nahi hai. Page refresh karke dobara try karein.",
  nonce_already_used:
    "Ye attempt pehle hi use ho chuka hai. Naya capture shuru karein.",
  nonce_expired:
    "Time limit khatam ho gaya. Camera dobara kholein aur turant capture karein.",
  nonce_wrong_action: "Request galat action ke liye thi. Dobara try karein.",

  already_checked_in: "Aap aaj pehle hi check-in kar chuke hain.",
  already_checked_out: "Aap aaj pehle hi check-out kar chuke hain.",
  check_out_needs_check_in: "Check-out se pehle check-in karna zaroori hai.",
  lunch_needs_check_in: "Lunch se pehle check-in karna zaroori hai.",
  lunch_not_started: "Pehle lunch start karein.",
  finish_lunch_first: "Check-out se pehle lunch complete karein.",

  location_missing: "Location nahi mili. Permission dekar dobara try karein.",
  accuracy_too_poor:
    "Location kaafi accurate nahi hai. Khuli jagah par jaakar dobara try karein.",
  location_stale:
    "Purani (cached) location mili. Thodi der baad dobara try karein.",
};

export function getAttendanceErrorMessage(code: string | null): string {
  if (!code) return "Kuch galat ho gaya. Dobara try karein.";
  return ERRORS[code] ?? "Verification fail ho gaya. Dobara try karein.";
}

/** Plain-language name for each risk signal, for the user's own review. */
const SIGNALS: Record<string, string> = {
  location_missing: "Location nahi mili",
  accuracy_too_poor: "Location accurate nahi thi",
  accuracy_low_confidence: "Location ki accuracy kam thi",
  location_stale: "Location purani thi",
  implausible_movement: "Pichhle event se movement asambhav laga",
  zero_gps_drift: "GPS bilkul nahi hila — sab readings same",
};

export function describeSignal(signal: RiskSignal): string {
  const label = SIGNALS[signal.signal] ?? signal.signal;
  return signal.detail ? `${label} (${signal.detail})` : label;
}

export const EVENT_LABELS: Record<AttendanceEventType, string> = {
  check_in: "Check-in",
  lunch_start: "Lunch start",
  lunch_end: "Lunch end",
  check_out: "Check-out",
};
