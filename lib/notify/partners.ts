import "server-only";

import { partnerActivityEmail, type PartnerEventKind } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { getAppUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Tells the people you are paired with that something happened.
 *
 * Two rules decide who hears about it, and both live in SQL
 * (`partners_to_notify`): the actor has to share that category, and the
 * recipient has to have asked for that kind of mail. Checking either here
 * would put a privacy rule in a place that is easy to forget to call.
 *
 * Failures are swallowed on purpose. A mail outage must never make a
 * check-in that was recorded look like it failed — the event is the record,
 * the email is a courtesy. Every attempt, including the failures, is written
 * to `email_logs`, so a message that did not arrive is answerable rather
 * than invisible.
 */

const PERMISSION: Record<PartnerEventKind, "attendance" | "leave"> = {
  check_in: "attendance",
  lunch_start: "attendance",
  lunch_end: "attendance",
  check_out: "attendance",
  leave: "leave",
};

/** Which of the recipient's switches has to be on. */
const NOTIFY_COLUMN: Record<PartnerEventKind, string> = {
  check_in: "check_in",
  lunch_start: "lunch",
  lunch_end: "lunch",
  check_out: "check_out",
  leave: "leave",
};

type Recipient = {
  partner_id: string;
  email: string;
  full_name: string | null;
};

export async function notifyPartners({
  actorId,
  actorName,
  kind,
  /** Distinguishes one occurrence from another, for the dedup key. */
  occurredOn,
  detail,
}: {
  actorId: string;
  actorName: string | null;
  kind: PartnerEventKind;
  occurredOn: string;
  /** Extra line for the body — a leave reason, for instance. */
  detail?: string | null;
}): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("partners_to_notify", {
    p_actor_id: actorId,
    p_permission: PERMISSION[kind],
    p_kind: NOTIFY_COLUMN[kind],
  });

  if (error) return;

  const recipients = (data ?? []) as Recipient[];
  const appUrl = getAppUrl();

  await Promise.all(
    recipients.map((recipient) => {
      const content = partnerActivityEmail({
        actorName,
        recipientName: recipient.full_name,
        kind,
        detail,
        appUrl,
      });

      return sendEmail({
        to: recipient.email,
        // The RECIPIENT owns this log row, because it is their inbox and
        // their dedup key. Logging it against the actor would make one
        // person's send suppress another's.
        userId: recipient.partner_id,
        template: "partner_activity",
        dedupKey: `${actorId}:${occurredOn}:${kind}`,
        ...content,
      });
    }),
  );
}
