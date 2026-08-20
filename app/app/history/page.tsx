import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { DayDetail } from "@/components/attendance/day-detail";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import {
  getAttendanceHistory,
  getEventsForAttendance,
  getLunchProofsForAttendance,
} from "@/lib/attendance/queries";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const profile = await requireProfile();

  const days = await getAttendanceHistory();
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
          Pichhle 30 din ka poora record — har event ki location aur photo.
        </p>
      </header>

      {days.length === 0 ? (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <CalendarDays
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Abhi koi record nahi. Pehla check-in karke shuruaat karein.
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
