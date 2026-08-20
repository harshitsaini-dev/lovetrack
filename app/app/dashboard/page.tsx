import type { Metadata } from "next";

import {
  TodayCard,
  TodayTimeline,
} from "@/components/attendance/today-card";
import { requireProfile } from "@/lib/auth/session";
import { getTodayAttendance } from "@/lib/attendance/queries";
import { formatShortDate, getHour } from "@/lib/format/datetime";
import { getTodayLunchProof } from "@/lib/lunch/queries";

export const metadata: Metadata = {
  title: "Dashboard",
};

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const { attendance, events } = await getTodayAttendance(profile.timezone);
  const lunchProof = attendance
    ? await getTodayLunchProof(attendance.id)
    : null;

  // Rendered on the server, in the user's own timezone — the client clock
  // is never authoritative anywhere in LoveTrack.
  const now = new Date();
  const hour = getHour(profile.timezone, now);
  const today = formatShortDate(now, profile.timezone);

  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{today}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting(hour)}, {firstName}
        </h1>
      </header>

      <TodayCard
        attendance={attendance}
        events={events}
        timezone={profile.timezone}
        lunchProofDone={lunchProof !== null}
      />

      <TodayTimeline events={events} timezone={profile.timezone} />
    </div>
  );
}
