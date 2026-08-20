import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import {
  getAttendanceHistory,
  getEventsForAttendance,
} from "@/lib/attendance/queries";
import { formatCalendarDate, formatTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/types/attendance";

export const metadata: Metadata = { title: "History" };

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  not_started: "Shuru nahi hua",
  checked_in: "Checked in",
  lunch_active: "Lunch chal raha hai",
  lunch_verified: "Lunch complete",
  checked_out: "Complete",
};

export default async function HistoryPage() {
  const profile = await requireProfile();

  const days = await getAttendanceHistory();
  const events = await getEventsForAttendance(days.map((d) => d.id));

  const time = (iso: string | null) =>
    formatTime(iso, profile.timezone) ?? "—";

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          Pichhle 30 din ka record.
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
          {days.map((day) => {
            const dayEvents = events.filter((e) => e.attendance_id === day.id);
            const flagged = dayEvents.filter((e) => e.status !== "passed").length;

            const date = formatCalendarDate(day.attendance_date);

            return (
              <li key={day.id}>
                <Card>
                  <CardContent className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium">{date}</p>
                      <p
                        className={cn(
                          "text-xs",
                          day.status === "checked_out"
                            ? "text-status-active"
                            : "text-muted-foreground",
                        )}
                      >
                        {STATUS_LABELS[day.status]}
                      </p>
                    </div>

                    <dl className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">In</dt>
                        <dd className="tabular-nums font-medium">
                          {time(day.check_in_at)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Lunch</dt>
                        <dd className="tabular-nums font-medium">
                          {time(day.lunch_verified_at ?? day.lunch_started_at)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Out</dt>
                        <dd className="tabular-nums font-medium">
                          {time(day.check_out_at)}
                        </dd>
                      </div>
                    </dl>

                    {flagged > 0 && (
                      <p className="text-xs text-status-warn">
                        {flagged} submission flagged
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
