"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";

import { reverseGeocode } from "@/lib/location/geocode";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getTodayInTimezone } from "@/lib/format/datetime";
import { notifyPartners } from "@/lib/notify/partners";
import { createClient } from "@/lib/supabase/server";
import type {
  AttendanceEventType,
  RecordEventResult,
} from "@/types/attendance";

const eventTypeSchema = z.enum([
  "check_in",
  "check_out",
  "lunch_start",
  "lunch_end",
]);

const submissionSchema = z.object({
  nonce: z.string().uuid(),
  eventType: eventTypeSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100_000),
  fixAgeS: z.number().min(0).max(86_400),
  photoPath: z.string().max(500).nullable(),
  placeLabel: z.string().max(200).nullable(),
  deviceLabel: z.string().max(200).nullable(),
});

export type AttendanceSubmission = z.infer<typeof submissionSchema>;

/**
 * Hashes the caller's IP rather than storing it.
 *
 * An IP is personal data and we only ever need to compare it, so a salted
 * digest is enough. Without a salt this would be trivially reversible —
 * the IPv4 space is small enough to brute-force in seconds.
 */
async function hashClientIp(): Promise<string | null> {
  const headerList = await headers();
  const forwarded =
    headerList.get("cf-connecting-ip") ??
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip");

  if (!forwarded) return null;

  const salt = process.env.NONCE_SECRET ?? "lovetrack-dev-salt";
  return createHash("sha256").update(`${salt}:${forwarded}`).digest("hex");
}

/**
 * Issues a single-use nonce, immediately before a capture.
 *
 * The nonce is what stops an old photo from being replayed later: the
 * database consumes it in the same transaction that records the event.
 */
export async function issueNonce(
  eventType: AttendanceEventType,
): Promise<{ ok: true; nonce: string } | { ok: false; error: string }> {
  const parsed = eventTypeSchema.safeParse(eventType);
  if (!parsed.success) return { ok: false, error: "invalid_event_type" };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "not_authenticated" };

  // Nonces are cheap to issue but not free — each one is a row, and a loop
  // requesting them would grow the table without bound. The allowance is
  // generous: retrying a failed capture is normal.
  const limit = await checkRateLimit("attendanceNonce", user.id);
  if (!limit.allowed) return { ok: false, error: "rate_limited" };
  const { data, error } = await supabase.rpc("issue_attendance_nonce", {
    p_event_type: parsed.data,
  });

  if (error || !data) return { ok: false, error: "nonce_issue_failed" };
  return { ok: true, nonce: data as string };
}

/**
 * Resolves a place name for the confirmation screen.
 *
 * Separate from the submission so the user can see where the app thinks
 * they are *before* committing to it, rather than discovering afterwards
 * that the reading was somewhere else entirely.
 */
export async function lookupPlaceName(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const coords = z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .safeParse({ latitude, longitude });

  if (!coords.success) return null;

  return reverseGeocode(coords.data.latitude, coords.data.longitude);
}

/**
 * Submits a capture for verification.
 *
 * Note what this function does NOT do: it never decides whether the
 * submission passed. It forwards the raw signals and lets the database
 * apply the thresholds, consume the nonce, enforce the state machine and
 * stamp the time. A client that lies about `accuracyM` still gets scored on
 * the value it sent, and one that lies about the *result* is simply ignored,
 * because the result is not an input.
 */
export async function submitAttendanceEvent(
  input: AttendanceSubmission,
): Promise<RecordEventResult> {
  const parsed = submissionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "invalid_submission" };
  }

  const supabase = await createClient();
  const ipHash = await hashClientIp();

  // Resolved here rather than in the browser so the request carries a
  // proper User-Agent and stays within Nominatim's rate limit. The label is
  // for humans; the coordinates remain the record.
  const placeLabel = await reverseGeocode(
    parsed.data.latitude,
    parsed.data.longitude,
  );

  const { data, error } = await supabase.rpc("record_attendance_event", {
    p_nonce: parsed.data.nonce,
    p_event_type: parsed.data.eventType,
    p_latitude: parsed.data.latitude,
    p_longitude: parsed.data.longitude,
    p_accuracy_m: parsed.data.accuracyM,
    p_fix_age_s: parsed.data.fixAgeS,
    p_photo_path: parsed.data.photoPath,
    p_place_label: placeLabel,
    p_device_label: parsed.data.deviceLabel,
    p_ip_hash: ipHash,
  });

  if (error) {
    return { ok: false, error: "verification_failed" };
  }

  const outcome = data as RecordEventResult;

  // Only once the day actually moved. A rejected submission is recorded as
  // evidence but changed nothing, so announcing it would be telling someone
  // about an event that did not happen.
  if (outcome.ok) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, timezone")
        .eq("id", user.id)
        .maybeSingle();

      // Awaited rather than fired and forgotten: a serverless function that
      // returns can be frozen mid-request, and a background send would be
      // lost often enough to look like flaky delivery. notifyPartners
      // swallows its own failures, so this cannot fail the check-in.
      await notifyPartners({
        actorId: user.id,
        actorName: profile?.full_name ?? null,
        kind: parsed.data.eventType,
        // Their local day, so one event yields one email even when the two
        // people are in different timezones.
        occurredOn: getTodayInTimezone(profile?.timezone ?? "Asia/Kolkata"),
      });
    }
  }

  // Deliberately no revalidatePath here. Revalidating re-renders the route
  // the action was called from — the capture page — whose guard now sees the
  // day has moved on and redirects to the dashboard, destroying the result
  // screen before the user can read their verification signals.
  //
  // Nothing is lost: every attendance page is dynamic (it reads cookies), so
  // there is no cached render to invalidate. Navigating to the dashboard
  // fetches the new state anyway.
  return outcome;
}
