import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { PublicSettings } from "@/types/attendance";

/**
 * Reading the tunables.
 *
 * These used to be environment variables. They are product decisions
 * rather than deployment facts, so they live in the database where an
 * admin can change them without a redeploy — and where the change is
 * audited.
 *
 * Secrets did NOT move. API keys, the service-role key and the cron secret
 * stay in the environment: a secret in a table an admin can read turns
 * every admin session into a way to exfiltrate it, and puts it in every
 * database backup.
 */

const DEFAULTS: PublicSettings = {
  lunch_min_seconds: 5,
  lunch_max_seconds: 20,
  lunch_max_bytes: 8_000_000,
  max_accuracy_m: 100,
  warn_accuracy_m: 50,
  max_fix_age_s: 30,
};

/** The rules a signed-in client legitimately needs to know up front. */
export async function getPublicSettings(): Promise<PublicSettings> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_settings");

  return (data as PublicSettings | null) ?? DEFAULTS;
}

/**
 * Lifetime for a signed media URL.
 *
 * Read with the admin client because it is needed on paths where the
 * caller may be a cron job rather than a session.
 */
export async function getSignedUrlTtl(): Promise<number> {
  const { data } = await createAdminClient()
    .from("system_settings")
    .select("signed_url_ttl_seconds")
    .single();

  return data?.signed_url_ttl_seconds ?? 300;
}
