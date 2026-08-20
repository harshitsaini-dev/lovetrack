import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CaptureFlow } from "@/components/attendance/capture-flow";
import { requireProfile } from "@/lib/auth/session";
import { getChallengePhrase } from "@/lib/attendance/challenge";
import { getTodayAttendance } from "@/lib/attendance/queries";

export const metadata: Metadata = { title: "Check out" };

export default async function CheckOutPage() {
  const profile = await requireProfile();
  const { attendance, today } = await getTodayAttendance(profile.timezone);

  if (!attendance || attendance.status === "not_started") {
    redirect("/app/dashboard");
  }
  if (attendance.status === "checked_out") {
    redirect("/app/dashboard");
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Check out</h1>
        <p className="text-sm text-muted-foreground">
          Din khatam. Ek aakhri live photo aur location.
        </p>
      </header>

      <CaptureFlow
        userId={profile.id}
        eventType="check_out"
        challenge={getChallengePhrase(profile.id, today)}
      />
    </div>
  );
}
