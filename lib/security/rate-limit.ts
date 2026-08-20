import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * Rate limiting.
 *
 * The counter lives in Postgres, not in memory: this app runs on
 * serverless workers, where an in-memory counter resets on every cold
 * start and is per-instance — a limit an attacker never actually meets.
 *
 * Identifiers are hashed before they become bucket names. A bucket called
 * "login:someone@example.com" would put every address that has ever tried
 * to sign in into a table, which is a list worth stealing.
 */

export type RateLimitResult = {
  allowed: boolean;
  attempts: number;
  limit: number;
  retryAfterSeconds: number;
};

/** Sensible defaults, tuned to be invisible to a real person. */
export const LIMITS = {
  // Six tries a minute is far more than anyone types by hand, and far
  // less than a script needs.
  login: { max: 6, windowSeconds: 60 },
  register: { max: 4, windowSeconds: 300 },
  passwordReset: { max: 3, windowSeconds: 900 },
  passwordChange: { max: 5, windowSeconds: 300 },
  // Pairing is the account-enumeration surface: the reply is deliberately
  // identical for known and unknown addresses, so the only thing left to
  // learn from is volume.
  pairingRequest: { max: 5, windowSeconds: 600 },
  // Generous — a genuine retry after a failed capture is normal.
  attendanceNonce: { max: 20, windowSeconds: 300 },
  lunchProof: { max: 10, windowSeconds: 600 },
} as const;

function hash(value: string): string {
  const salt = process.env.NONCE_SECRET ?? "lovetrack-dev-salt";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

/** The caller's IP, so a limit cannot be sidestepped by changing email. */
export async function getClientKey(): Promise<string> {
  const headerList = await headers();

  const ip =
    headerList.get("cf-connecting-ip") ??
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "unknown";

  return hash(ip);
}

/**
 * Counts one attempt and says whether it is allowed.
 *
 * Fails OPEN. If the database is unreachable, the alternative is locking
 * everybody out of their own attendance because the counter is down —
 * a worse outcome than briefly unmetered attempts, given the other
 * controls that stay in force either way.
 */
export async function checkRateLimit(
  action: keyof typeof LIMITS,
  identifier: string,
): Promise<RateLimitResult> {
  const { max, windowSeconds } = LIMITS[action];
  const bucket = `${action}:${hash(identifier)}`;

  try {
    const { data, error } = await createAdminClient().rpc("check_rate_limit", {
      p_bucket: bucket,
      p_max_attempts: max,
      p_window_seconds: windowSeconds,
    });

    if (error || !data) {
      return { allowed: true, attempts: 0, limit: max, retryAfterSeconds: 0 };
    }

    const result = data as {
      allowed: boolean;
      attempts: number;
      limit: number;
      retry_after_seconds: number;
    };

    return {
      allowed: result.allowed,
      attempts: result.attempts,
      limit: result.limit,
      retryAfterSeconds: result.retry_after_seconds,
    };
  } catch {
    return { allowed: true, attempts: 0, limit: max, retryAfterSeconds: 0 };
  }
}

/**
 * Checks the caller's IP and one other identifier together.
 *
 * Both matter: the IP alone lets one attacker work through many accounts
 * from one place, and the identifier alone lets them spread one account
 * across many addresses.
 */
export async function checkRateLimitFor(
  action: keyof typeof LIMITS,
  identifier: string,
): Promise<RateLimitResult> {
  const [byIp, byIdentifier] = await Promise.all([
    checkRateLimit(action, `ip:${await getClientKey()}`),
    checkRateLimit(action, `id:${identifier.toLowerCase().trim()}`),
  ]);

  // Report whichever is closest to tripping, so the message is accurate.
  return byIp.allowed ? byIdentifier : byIp;
}

export function rateLimitMessage(result: RateLimitResult): string {
  const seconds = result.retryAfterSeconds;

  if (seconds >= 60) {
    return `Bahut zyada koshishein. ${Math.ceil(seconds / 60)} minute baad try karein.`;
  }
  return `Bahut zyada koshishein. ${Math.max(seconds, 5)} second baad try karein.`;
}
