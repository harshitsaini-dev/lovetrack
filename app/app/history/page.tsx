import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { DayDetail } from "@/components/attendance/day-detail";
import { DateFilter } from "@/components/history/date-filter";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import {
  getAttendanceHistory,
  getEventsForAttendance,
  getLunchProofsForAttendance,
} from "@/lib/attendance/queries";
import { formatCalendarDate } from "@/lib/format/datetime";

export const metadata: Metadata = { title: "History" };

/** Ignores anything that is not an ISO date, rather than passing it to SQL. */
function asDate(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;

  const from = asDate(params.from);
  const to = asDate(params.to);
  const filtered = Boolean(from || to);

  const days = await getAttendanceHistory({ from, to });
  const ids = days.map((d) => d.id);

  const [events, lunchProofs] = await Promise.all([
    getEventsForAttendance(ids),
    getLunchProofsForAttendance(ids),
  ]);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          {filtered
            ? // Says what is actually on screen. "Last 30 days" above a
              // filtered list would simply be untrue.
              `${from ? formatCalendarDate(from) : "Shuruaat"} se ${
                to ? formatCalendarDate(to) : "aaj"
              } tak`
            : "Pichhle 30 din ka poora record — har event ki location aur photo."}
        </p>
      </header>

      <DateFilter from={from} to={to} action="/app/history" />

      {days.length === 0 ? (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <CalendarDays
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="mt-3 text-sm text-muted-foreground">
              {filtered
                ? "In dates me koi record nahi mila."
                : "Abhi koi record nahi. Pehla check-in karke shuruaat karein."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {days.map((day) => (
            <li key={day.id}>
              <DayDetail
                day={day}
                // Your own media is always yours to look at, as often as
                // you like, and nobody is notified when you do.
                events={events
                  .filter((e) => e.attendance_id === day.id)
                  .map((e) => ({
                    id: e.id,
                    event_type: e.event_type,
                    server_timestamp: e.server_timestamp,
                    place_label: e.place_label,
                    latitude: e.latitude,
                    longitude: e.longitude,
                    accuracy_m: e.accuracy_m,
                    has_photo: e.photo_path !== null,
                    photo_viewable: e.photo_path !== null,
                    status: e.status,
                    risk_score: e.risk_score,
                    device_label: e.device_label,
                  }))}
                lunchProof={
                  lunchProofs.find((p) => p.attendance_id === day.id) ?? null
                }
                timezone={profile.timezone}
                ownerName="Aapki"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
