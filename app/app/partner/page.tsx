import type { Metadata } from "next";
import { HeartHandshake } from "lucide-react";

import { PairRequestForm } from "@/components/partner/pair-request-form";
import { PartnerActivity } from "@/components/partner/partner-activity";
import { PendingRequests } from "@/components/partner/pending-requests";
import { SharingControls } from "@/components/partner/sharing-controls";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import { getTodayInTimezone } from "@/lib/format/datetime";
import { getPairsForCurrentUser, type PairView } from "@/lib/pairing/queries";
import {
  getPartnerEvents,
  getPartnerDays,
  getPartnerLeave,
  getPartnerPermissions,
} from "@/lib/partner/queries";

export const metadata: Metadata = {
  title: "Partner",
};

/**
 * Loads one partner's day.
 *
 * Everything comes back already filtered by what they share — the database
 * functions null the location fields when that switch is off, so nothing
 * here has to remember to.
 */
async function loadActivity(view: PairView, today: string) {
  const partnerId = view.partner.id;

  const [permissions, days, events, leave] = await Promise.all([
    getPartnerPermissions(partnerId),
    getPartnerDays(partnerId, 1),
    getPartnerEvents(partnerId, today),
    getPartnerLeave(partnerId, 5),
  ]);

  return {
    permissions,
    today: days.find((d) => d.attendance_date === today) ?? null,
    events,
    leaveToday: leave.find((l) => l.leave_date === today) ?? null,
  };
}

export default async function PartnerPage() {
  const profile = await requireProfile();
  const today = getTodayInTimezone(profile.timezone);

  const { accepted, incoming, outgoing } = await getPairsForCurrentUser();
  const activity = await Promise.all(
    accepted.map(async (view) => ({
      view,
      ...(await loadActivity(view, today)),
    })),
  );

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Partner</h1>
        <p className="text-sm text-muted-foreground">
          Pairing dono ki marzi se hoti hai, aur sharing aap kabhi bhi band kar
          sakte hain.
        </p>
      </header>

      <PendingRequests incoming={incoming} outgoing={outgoing} />

      {activity.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Aaj ki activity
          </h2>
          {activity.map(({ view, permissions, today: day, events, leaveToday }) => (
            <PartnerActivity
              key={view.pair.id}
              partner={view.partner}
              timezone={profile.timezone}
              permissions={permissions}
              today={day}
              events={events}
              leaveToday={leaveToday}
            />
          ))}
        </section>
      )}

      {accepted.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Aap kya share karte hain
          </h2>
          {accepted.map((view) => (
            <SharingControls key={view.pair.id} view={view} />
          ))}
        </section>
      )}

      {accepted.length === 0 && incoming.length === 0 && (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <HeartHandshake
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Abhi koi pairing nahi hai. Neeche se request bhejein.
            </p>
          </CardContent>
        </Card>
      )}

      <PairRequestForm />
    </div>
  );
}
