import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CaptureFlow } from "@/components/attendance/capture-flow";
import { LunchFlow } from "@/components/lunch/lunch-flow";
import {
  getChallenge,
  getLunchVideoChallenge,
} from "@/lib/attendance/challenge";
import { getTodayAttendance } from "@/lib/attendance/queries";
import { requireProfile } from "@/lib/auth/session";
import { getTodayLunchProof } from "@/lib/lunch/queries";
import { getPrimaryPartnerName } from "@/lib/pairing/queries";

export const metadata: Metadata = { title: "Lunch" };

/**
 * One route for the whole lunch sequence, because which step you are on is
 * a property of the day, not of the URL. Deep-linking to "lunch" should
 * simply show whatever comes next.
 */
export default async function LunchPage() {
  const profile = await requireProfile();
  const { attendance } = await getTodayAttendance(profile.timezone);

  if (!attendance || attendance.status === "not_started") {
    redirect("/app/dashboard");
  }

  const partnerName = await getPrimaryPartnerName();

  // Lunch not started yet.
  if (attendance.status === "checked_in") {
    return (
      <div className="space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Lunch start</h1>
          <p className="text-sm text-muted-foreground">
            Live photo aur us waqt ki location.
          </p>
        </header>

        <CaptureFlow
          userId={profile.id}
          eventType="lunch_start"
          challenge={getChallenge("lunch_start", partnerName)}
        />
      </div>
    );
  }

  // Lunch running — the next step is to end it.
  if (attendance.status === "lunch_active") {
    return (
      <div className="space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Lunch end</h1>
          <p className="text-sm text-muted-foreground">
            Lunch khatam. Iske baad ek chhoti si proof video.
          </p>
        </header>

        <CaptureFlow
          userId={profile.id}
          eventType="lunch_end"
          challenge={getChallenge("lunch_end", partnerName)}
        />
      </div>
    );
  }

  const proof = await getTodayLunchProof(attendance.id);

  if (proof) {
    redirect("/app/dashboard");
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Lunch proof</h1>
        <p className="text-sm text-muted-foreground">
          5-20 second ki video — khana khate hue banayein.
        </p>
      </header>

      <LunchFlow
        userId={profile.id}
        challenge={getLunchVideoChallenge(partnerName)}
      />
    </div>
  );
}
