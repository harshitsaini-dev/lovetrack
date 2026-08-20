import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * Sending, logging and de-duplication in one place.
 *
 * Every send is written to `email_logs`, including the failures — an email
 * that silently did not arrive is worse than one that visibly bounced,
 * because nobody goes looking for it.
 *
 * The log is also what stops duplicates: a unique index on
 * (user_id, template, dedup_key) means a cron retry collides instead of
 * reminding somebody twice.
 */

const ENDPOINT = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Which template this is, for the log. */
  template: string;
  userId?: string | null;
  /**
   * Makes a send unique — the date, for a daily reminder. Omit for mail
   * that may legitimately go out more than once.
   */
  dedupKey?: string | null;
};

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: "not_configured" | "duplicate" | "failed"; error?: string };

function getConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) return null;
  return { apiKey, from };
}

/** Has this exact message already gone out? */
async function alreadySent(
  userId: string,
  template: string,
  dedupKey: string,
): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("email_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("template", template)
    .eq("dedup_key", dedupKey)
    .eq("status", "sent")
    .maybeSingle();

  return data !== null;
}

async function log(
  input: SendEmailInput,
  status: "sent" | "failed" | "skipped",
  extra: { providerId?: string | null; error?: string } = {},
): Promise<void> {
  // The service role, because email_logs has no INSERT policy: nothing
  // should be able to forge a delivery record.
  await createAdminClient()
    .from("email_logs")
    .insert({
      user_id: input.userId ?? null,
      template: input.template,
      to_email: input.to,
      subject: input.subject,
      status,
      provider_id: extra.providerId ?? null,
      error: extra.error ?? null,
      dedup_key: input.dedupKey ?? null,
    });
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const config = getConfig();

  if (!config) {
    // Not an error: a developer without Resend keys should still be able to
    // run the app, they just do not get mail.
    return { ok: false, reason: "not_configured" };
  }

  if (input.userId && input.dedupKey) {
    if (await alreadySent(input.userId, input.template, input.dedupKey)) {
      return { ok: false, reason: "duplicate" };
    }
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const error = await response.text();
      await log(input, "failed", { error: error.slice(0, 500) });
      return { ok: false, reason: "failed", error };
    }

    const body = (await response.json()) as { id?: string };
    await log(input, "sent", { providerId: body.id ?? null });

    return { ok: true, id: body.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await log(input, "failed", { error: message.slice(0, 500) });
    return { ok: false, reason: "failed", error: message };
  }
}
