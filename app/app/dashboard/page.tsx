import type { Metadata } from "next";

import {
  TodayCard,
  TodayTimeline,
} from "@/components/attendance/today-card";
import { requireProfile } from "@/lib/auth/session";
import { getTodayAttendance } from "@/lib/attendance/queries";

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

  // Rendered on the server, in the user's own timezone — the client clock
  // is never authoritative anywhere in LoveTrack.
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: profile.timezone,
    }).format(now),
  );
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: profile.timezone,
  }).format(now);

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
      />

      <TodayTimeline events={events} timezone={profile.timezone} />
    </div>
  );
}
