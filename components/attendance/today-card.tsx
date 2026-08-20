import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  Check,
  Clock,
  LogOut,
  Utensils,
  Video,
} from "lucide-react";

import { LocationMap } from "@/components/location/location-map";
import { MapLink } from "@/components/location/map-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/format/datetime";
import { EVENT_LABELS } from "@/lib/attendance/messages";
import { cn } from "@/lib/utils";
import type {
  Attendance,
  AttendanceEvent,
  AttendanceEventType,
} from "@/types/attendance";


const STEPS: {
  type: AttendanceEventType;
  icon: typeof Camera;
  at: keyof Pick<
    Attendance,
    "check_in_at" | "lunch_started_at" | "lunch_verified_at" | "check_out_at"
  >;
}[] = [
  { type: "check_in", icon: Camera, at: "check_in_at" },
  { type: "lunch_start", icon: Utensils, at: "lunch_started_at" },
  { type: "lunch_end", icon: Utensils, at: "lunch_verified_at" },
  { type: "check_out", icon: LogOut, at: "check_out_at" },
];

export function TodayCard({
  attendance,
  events,
  timezone,
  lunchProofDone,
}: {
  attendance: Attendance | null;
  events: AttendanceEvent[];
  timezone: string;
  lunchProofDone: boolean;
}) {
  const status = attendance?.status ?? "not_started";
  const flagged = events.filter((e) => e.status !== "passed");

  /*
   * The primary action is whatever the day needs next.
   *
   * The three lunch steps are named separately -- "Lunch in", "Lunch verify",
   * "Lunch out" -- rather than sharing one "Lunch" label. They all lead to
   * /app/lunch, which routes by state, but a button that says the same thing
   * three times gives no way to tell how far through the meal you are, and
   * "Lunch" when the next step is recording a video is simply misleading.
   *
   * Lunch is optional, so once someone is checked in they get both choices
   * rather than being funnelled through a meal they may have skipped.
   */
  const primary =
    status === "not_started"
      ? { href: "/app/check-in", label: "Check in", icon: Camera }
      : status === "lunch_active" && !lunchProofDone
        ? { href: "/app/lunch", label: "Lunch verify karein", icon: Video }
        : status === "lunch_active"
          ? { href: "/app/lunch", label: "Lunch out", icon: Utensils }
          : status === "checked_in" || status === "lunch_verified"
            ? { href: "/app/check-out", label: "Check out", icon: LogOut }
            : null;

  const secondary =
    status === "checked_in"
      ? { href: "/app/lunch", label: "Lunch in", icon: Utensils }
      : null;

  return (
    <Card>
      <CardContent className="space-y-4">
        <ol className="space-y-2.5">
          {STEPS.map(({ type, icon: Icon, at }) => {
            const time = attendance ? formatTime(attendance[at], timezone) : null;
            const done = Boolean(time);

            return (
              <li key={type} className="flex items-center gap-2.5 text-sm">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    done
                      ? "bg-status-active/15 text-status-active"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    <Icon className="size-3.5" aria-hidden />
                  )}
                </span>

                <span className={cn("flex-1", !done && "text-muted-foreground")}>
                  {EVENT_LABELS[type]}
                </span>

                <span
                  className={cn(
                    "tabular-nums",
                    done ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {time ?? "—"}
                </span>
              </li>
            );
          })}
        </ol>

        {flagged.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-status-warn/10 p-2.5">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-status-warn"
              aria-hidden
            />
            <p className="text-xs text-muted-foreground">
              {flagged.length} submission review ke liye flag hui{" "}
              {flagged.length > 1 ? "hain" : "hai"}.
            </p>
          </div>
        )}

        {primary ? (
          <div className="space-y-2">
            <Button asChild size="lg" className="touch-target h-12 w-full">
              <Link href={primary.href}>
                <primary.icon className="size-4" aria-hidden />
                {primary.label}
              </Link>
            </Button>

            {secondary && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="touch-target h-11 w-full"
              >
                <Link href={secondary.href}>
                  <secondary.icon className="size-4" aria-hidden />
                  {secondary.label}
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 py-1 text-sm text-muted-foreground">
            <Clock className="size-4" aria-hidden />
            Aaj ka din complete.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Compact list of today's events with their captured places. */
export function TodayTimeline({
  events,
  timezone,
}: {
  events: AttendanceEvent[];
  timezone: string;
}) {
  if (!events.length) return null;

  const located = events.filter(
    (e): e is AttendanceEvent & { latitude: number; longitude: number } =>
      e.latitude !== null && e.longitude !== null,
  );

  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="text-sm font-medium">Aaj ki timeline</h2>

        {located.length > 0 && (
          <LocationMap
            points={located.map((e) => ({
              latitude: e.latitude,
              longitude: e.longitude,
              accuracyM: e.accuracy_m,
              label: `${EVENT_LABELS[e.event_type]}${
                e.place_label ? ` · ${e.place_label}` : ""
              }`,
            }))}
            className="h-48"
          />
        )}

        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-2.5 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />

              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {EVENT_LABELS[event.event_type]}
                  {event.status !== "passed" && (
                    <span className="ml-2 text-xs font-normal text-status-warn">
                      {event.status === "rejected" ? "rejected" : "flagged"}
                    </span>
                  )}
                </p>

                {event.latitude !== null && (
                  <>
                    {/*
                      Place name first — it is what a person actually reads.
                      The coordinates stay visible underneath because they
                      are the record, and the accuracy is part of the claim.
                    */}
                    <MapLink
                      latitude={event.latitude}
                      longitude={event.longitude!}
                      label={event.place_label ?? "Jagah ka naam nahi mila"}
                    />
                    <p className="pl-4 text-xs tabular-nums text-muted-foreground/80">
                      {event.latitude.toFixed(5)},{" "}
                      {event.longitude?.toFixed(5)}
                      {event.accuracy_m !== null &&
                        ` · ±${Math.round(event.accuracy_m)}m`}
                    </p>
                  </>
                )}
              </div>

              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {formatTime(event.server_timestamp, timezone)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
