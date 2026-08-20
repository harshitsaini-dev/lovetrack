import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EyeOff } from "lucide-react";

import { PartnerHistory } from "@/components/partner/partner-activity";
import { PartnerIdentity } from "@/components/partner/partner-identity";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import { getPairsForCurrentUser } from "@/lib/pairing/queries";
import {
  getPartnerDays,
  getPartnerEvents,
  getPartnerLunchProofs,
  getPartnerPermissions,
} from "@/lib/partner/queries";

export const metadata: Metadata = { title: "Partner history" };

export default async function PartnerHistoryPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = await params;
  const profile = await requireProfile();

  // Only someone you are actually paired with has a page here. Anything
  // else is a 404 rather than a 403 — confirming that an id belongs to a
  // real account is itself a small disclosure.
  const { accepted } = await getPairsForCurrentUser();
  const view = accepted.find((v) => v.partner.id === partnerId);

  if (!view) notFound();

  const [permissions, days, events, lunchProofs] = await Promise.all([
    getPartnerPermissions(partnerId),
    getPartnerDays(partnerId, 30),
    getPartnerEvents(partnerId),
    getPartnerLunchProofs(partnerId),
  ]);

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <PartnerIdentity partner={view.partner} />
      </header>

      {permissions.attendance ? (
        <PartnerHistory
          days={days}
          events={events}
          lunchProofs={permissions.lunch_proof ? lunchProofs : []}
          timezone={profile.timezone}
          partnerName={view.partner.full_name ?? "Partner"}
          locationShared={permissions.location}
        />
      ) : (
        <Card>
          <CardContent className="flex items-start gap-2 py-6">
            <EyeOff
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              Ye apni activity share nahi kar rahe.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
