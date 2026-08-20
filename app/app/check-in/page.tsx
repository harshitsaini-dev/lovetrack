import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CaptureFlow } from "@/components/attendance/capture-flow";
import { requireProfile } from "@/lib/auth/session";
import { getChallenge } from "@/lib/attendance/challenge";
import { getTodayAttendance } from "@/lib/attendance/queries";
import { getPrimaryPartnerName } from "@/lib/pairing/queries";

export const metadata: Metadata = { title: "Check in" };

export default async function CheckInPage() {
  const profile = await requireProfile();
  const { attendance } = await getTodayAttendance(profile.timezone);

  // The database enforces this too; catching it here just saves the user
  // from opening their camera for a submission that cannot succeed.
  if (attendance && attendance.status !== "not_started") {
    redirect("/app/dashboard");
  }

  const partnerName = await getPrimaryPartnerName();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Check in</h1>
        <p className="text-sm text-muted-foreground">
          Live photo aur us waqt ki location — kahin se bhi kar sakte hain.
        </p>
      </header>

      <CaptureFlow
        userId={profile.id}
        eventType="check_in"
        challenge={getChallenge("check_in", partnerName)}
      />
    </div>
  );
}
