import Link from "next/link";
import {
  ChevronRight,
  Circle,
  EyeOff,
  MapPin,
  MapPinOff,
  Moon,
} from "lucide-react";

import { DayDetail } from "@/components/attendance/day-detail";
import { LocationMap } from "@/components/location/location-map";
import { MapLink } from "@/components/location/map-link";
import { MediaViewer } from "@/components/media/media-viewer";
import { PartnerIdentity } from "@/components/partner/partner-identity";
import { Card, CardContent } from "@/components/ui/card";
import { EVENT_LABELS } from "@/lib/attendance/messages";
import { formatTime } from "@/lib/format/datetime";
import type { LeaveEntry } from "@/lib/leave/queries";
import type {
  PartnerDay,
  PartnerEvent,
  PartnerLunchProof,
  PartnerPermissions,
} from "@/lib/partner/queries";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

type PartnerLike = Pick<Profile, "id" | "full_name" | "email" | "avatar_url">;

const STATUS_TEXT: Record<PartnerDay["status"], string> = {
  not_started: "Abhi shuru nahi kiya",
  checked_in: "Checked in",
  lunch_active: "Lunch par hain",
  lunch_verified: "Lunch complete",
  checked_out: "Din complete",
};

const STATUS_TONE: Record<PartnerDay["status"], string> = {
  not_started: "text-muted-foreground",
  checked_in: "text-status-active",
  lunch_active: "text-status-lunch",
  lunch_verified: "text-status-active",
  checked_out: "text-muted-foreground",
};

/**
 * A partner's day.
 *
 * This is a record of what already happened, never a live position. Each
 * pin is somewhere a capture took place; LoveTrack does not track anyone,
 * so there is nothing here that updates while you watch.
 */
export function PartnerActivity({
  partner,
  timezone,
  permissions,
  today,
  events,
  leaveToday,
  lunchProof,
}: {
  partner: PartnerLike;
  timezone: string;
  permissions: PartnerPermissions;
  today: PartnerDay | null;
  events: PartnerEvent[];
  leaveToday: LeaveEntry | null;
  lunchProof?: PartnerLunchProof | null;
}) {
  if (!permissions.attendance) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <PartnerIdentity partner={partner} />
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3">
            <EyeOff
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              Ye apni activity abhi share nahi kar rahe. Ye unka faisla hai —
              aap ise badal nahi sakte.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const firstName = partner.full_name?.split(" ")[0] ?? "Partner";

  const located = events.filter(
    (e): e is PartnerEvent & { latitude: number; longitude: number } =>
      e.latitude !== null && e.longitude !== null,
  );

  return (
    <Card>
      <CardContent className="space-y-4">
        <PartnerIdentity partner={partner} />

        {leaveToday ? (
          <div className="flex items-start gap-2.5 rounded-lg bg-accent/60 p-3">
            <Moon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium">Aaj chhutti par hain</p>
              <p className="text-xs text-muted-foreground">
                {leaveToday.reason}
              </p>
            </div>
          </div>
        ) : (
          <p
            className={cn(
              "flex items-center gap-2 text-sm font-medium",
              STATUS_TONE[today?.status ?? "not_started"],
            )}
          >
            <Circle className="size-2.5 fill-current" aria-hidden />
            {STATUS_TEXT[today?.status ?? "not_started"]}
          </p>
        )}

        {today && (
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {(
              [
                ["Check-in", today.check_in_at],
                ["Lunch in", today.lunch_started_at],
                ["Lunch out", today.lunch_verified_at],
                ["Check-out", today.check_out_at],
              ] as const
            ).map(([label, at]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums">
                  {formatTime(at, timezone) ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/*
          The empty state has to distinguish two very different things:
          "they don't share where they were" is not the same as "we don't
          know". Saying nothing at all would quietly imply the second.
        */}
        {!permissions.location && events.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPinOff className="size-3.5 shrink-0" aria-hidden />
            Location share nahi ki gayi — sirf timings dikh rahe hain.
          </p>
        )}

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
            className="h-44"
          />
        )}

        {events.length > 0 ? (
          <ul className="space-y-2.5">
            {events.map((event) => (
              <li key={event.id} className="flex items-start gap-2.5 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">
                    {EVENT_LABELS[event.event_type]}
                  </p>

                  {event.latitude !== null && event.longitude !== null ? (
                    <MapLink
                      latitude={event.latitude}
                      longitude={event.longitude}
                      label={event.place_label}
                    />
                  ) : (
                    event.place_label && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{event.place_label}</span>
                      </p>
                    )
                  )}

                  {event.has_photo && event.photo_shared && (
                    <MediaViewer
                      kind="photo"
                      id={event.id}
                      alt={`${firstName} ki ${EVENT_LABELS[event.event_type]} photo`}
                    />
                  )}
                </div>

                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatTime(event.server_timestamp, timezone)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          !leaveToday && (
            <p className="text-sm text-muted-foreground">
              Aaj abhi tak koi activity nahi.
            </p>
          )
        )}

        {lunchProof && permissions.lunch_proof && (
          <div className="space-y-1.5 rounded-lg border p-3">
            <p className="text-sm font-medium">Lunch proof video</p>
            <MediaViewer
              kind="video"
              id={lunchProof.id}
              alt={`${firstName} ki lunch proof video`}
            />
          </div>
        )}

        <Link
          href={`/app/partner/${partner.id}`}
          className="flex items-center justify-between rounded-md py-1 text-sm font-medium text-primary"
        >
          Poori history dekhein
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}

/** Day-by-day history on the partner's own page. */
export function PartnerHistory({
  days,
  events,
  lunchProofs,
  timezone,
  partnerName,
  locationShared,
}: {
  days: PartnerDay[];
  events: PartnerEvent[];
  lunchProofs: PartnerLunchProof[];
  timezone: string;
  partnerName: string;
  locationShared: boolean;
}) {
  if (days.length === 0) {
    return (
      <Card className="border-dashed bg-transparent shadow-none">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Abhi koi record nahi hai.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {!locationShared && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPinOff className="size-3.5 shrink-0" aria-hidden />
          Location share nahi ki gayi — sirf timings dikh rahe hain.
        </p>
      )}

      {days.map((day) => (
        <DayDetail
          key={day.id}
          day={day}
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
              has_photo: e.has_photo,
              photo_viewable: e.photo_shared,
            }))}
          lunchProof={
            lunchProofs.find((p) => p.attendance_id === day.id) ?? null
          }
          timezone={timezone}
          ownerName={partnerName}
        />
      ))}
    </div>
  );
}
