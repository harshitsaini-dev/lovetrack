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
 *
 * The order is: start -> verification clip -> end. The clip sits in the
 * middle because that is the stretch it is evidence for; recorded after
 * the meal was already marked complete, as it used to be, it proved
 * nothing about it.
 *
 * Lunch in and lunch out take no photo of their own. Three face captures
 * around one meal is friction with nothing behind it — the clip between
 * them covers the whole period.
 */
export default async function LunchPage() {
  const profile = await requireProfile();
  const { attendance } = await getTodayAttendance(profile.timezone);

  if (!attendance || attendance.status === "not_started") {
    redirect("/app/dashboard");
  }

  const partnerName = await getPrimaryPartnerName();

  // Step 1 — lunch has not started.
  if (attendance.status === "checked_in") {
    return (
      <div className="space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Lunch in</h1>
          <p className="text-sm text-muted-foreground">
            Sirf abhi ki location — photo nahi.
          </p>
        </header>

        <CaptureFlow
          userId={profile.id}
          eventType="lunch_start"
          challenge={getChallenge("lunch_start", partnerName)}
          requirePhoto={false}
        />
      </div>
    );
  }

  if (attendance.status === "lunch_active") {
    const proof = await getTodayLunchProof(attendance.id);

    // Step 2 — the verification clip, recorded during the meal.
    if (!proof) {
      return (
        <div className="space-y-5">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Lunch verify
            </h1>
            <p className="text-sm text-muted-foreground">
              5-20 second ki video — khana khate hue banayein. Iske baad hi
              lunch out kar payenge.
            </p>
          </header>

          <LunchFlow
            userId={profile.id}
            challenge={getLunchVideoChallenge(partnerName)}
          />
        </div>
      );
    }

    // Step 3 — the clip is in, so lunch can be ended.
    return (
      <div className="space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Lunch out</h1>
          <p className="text-sm text-muted-foreground">
            Verification ho chuki hai. Sirf abhi ki location chahiye.
          </p>
        </header>

        <CaptureFlow
          userId={profile.id}
          eventType="lunch_end"
          challenge={getChallenge("lunch_end", partnerName)}
          requirePhoto={false}
        />
      </div>
    );
  }

  // Lunch is finished for the day.
  redirect("/app/dashboard");
}
