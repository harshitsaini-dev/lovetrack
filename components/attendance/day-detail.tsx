import { CameraOff, Crosshair, MapPinOff, Utensils } from "lucide-react";

import { DeleteEntry } from "@/components/admin/delete-entry";
import { MapLink } from "@/components/location/map-link";
import { MediaViewer } from "@/components/media/media-viewer";
import { Card, CardContent } from "@/components/ui/card";
import { EVENT_LABELS } from "@/lib/attendance/messages";
import { formatCalendarDate, formatTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";
import type {
  AttendanceEventType,
  AttendanceStatus,
  VerificationStatus,
} from "@/types/attendance";

/**
 * One day, in full.
 *
 * Shared by three screens that used to show three different amounts of the
 * same thing: your own history, a partner's history, and the admin view of
 * a user. They differ only in what they are allowed to show, so they take
 * the same component and pass different flags — a second implementation is
 * how one of them quietly stops showing the photo.
 *
 * Media is never fetched on render. Each viewer mints its own short-lived
 * signed URL when someone presses the button, and can be pressed again as
 * often as they like; nothing here is a one-time look.
 */

export type DetailEvent = {
  id: string;
  event_type: AttendanceEventType;
  server_timestamp: string;
  place_label: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  /** A photo was captured — whether or not this viewer may open it. */
  has_photo: boolean;
  /** This viewer may open it. */
  photo_viewable: boolean;
  /** Admin view only. */
  status?: VerificationStatus | null;
  risk_score?: number | null;
  device_label?: string | null;
};

export type DetailDay = {
  id: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  lunch_started_at: string | null;
  lunch_verified_at: string | null;
  check_out_at: string | null;
};

export type DetailLunchProof = {
  id: string;
  attendance_id: string;
  created_at: string;
  duration_s: number | null;
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  not_started: "Shuru nahi hua",
  checked_in: "Checked in",
  lunch_active: "Lunch chal raha hai",
  lunch_verified: "Lunch complete",
  checked_out: "Complete",
};

const VERIFICATION_TONE: Record<VerificationStatus, string> = {
  passed: "text-status-active",
  flagged: "text-status-warn",
  rejected: "text-destructive",
};

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  passed: "Verified",
  flagged: "Flagged",
  rejected: "Rejected",
};

function EventRow({
  event,
  timezone,
  auditNotice,
  ownerName,
  deletable,
}: {
  event: DetailEvent;
  timezone: string;
  auditNotice: boolean;
  ownerName: string;
  deletable: boolean;
}) {
  const label = EVENT_LABELS[event.event_type];
  const hasCoords = event.latitude !== null && event.longitude !== null;

  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatTime(event.server_timestamp, timezone)}
        </span>
      </div>

      {event.status && event.status !== "passed" && (
        <p className={cn("text-xs font-medium", VERIFICATION_TONE[event.status])}>
          {VERIFICATION_LABELS[event.status]}
          {typeof event.risk_score === "number" && ` · risk ${event.risk_score}`}
        </p>
      )}

      {hasCoords ? (
        <div className="space-y-0.5">
          <MapLink
            latitude={event.latitude!}
            longitude={event.longitude!}
            label={event.place_label}
          />
          {typeof event.accuracy_m === "number" && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Crosshair className="size-3 shrink-0" aria-hidden />
              ±{Math.round(event.accuracy_m)} m
            </p>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPinOff className="size-3 shrink-0" aria-hidden />
          Location share nahi ki gayi
        </p>
      )}

      {event.device_label && (
        <p className="text-xs text-muted-foreground">{event.device_label}</p>
      )}

      {event.has_photo && event.photo_viewable && (
        <MediaViewer
          kind="photo"
          id={event.id}
          alt={`${ownerName} ki ${label} photo`}
          auditNotice={auditNotice}
        />
      )}

      {/*
        Said out loud rather than left blank. "There is a photo you cannot
        see" and "no photo was taken" are different facts, and collapsing
        them would misrepresent what happened.
      */}
      {event.has_photo && !event.photo_viewable && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CameraOff className="size-3 shrink-0" aria-hidden />
          Photo li gayi thi, lekin share nahi ki gayi
        </p>
      )}

      {deletable && (
        <DeleteEntry
          kind="event"
          id={event.id}
          what={`${label} · ${formatTime(event.server_timestamp, timezone)}`}
        />
      )}
    </li>
  );
}

export function DayDetail({
  day,
  events,
  lunchProof,
  timezone,
  ownerName,
  auditNotice = false,
  lunchProofViewable = true,
  deletable = false,
}: {
  day: DetailDay;
  events: DetailEvent[];
  lunchProof?: DetailLunchProof | null;
  timezone: string;
  /** Whose day this is, for image alt text. */
  ownerName: string;
  /** True when opening media is recorded against the viewer. */
  auditNotice?: boolean;
  lunchProofViewable?: boolean;
  /** Admins only: offer to remove a wrong entry. */
  deletable?: boolean;
}) {
  const time = (iso: string | null) => formatTime(iso, timezone) ?? "—";

  // Oldest first inside a day: a day reads forwards even though the list of
  // days reads backwards.
  const ordered = [...events].sort((a, b) =>
    a.server_timestamp.localeCompare(b.server_timestamp),
  );

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium">{formatCalendarDate(day.attendance_date)}</p>
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

        {/*
          Lunch in and lunch out are shown separately. Collapsing them into
          one "Lunch" column hid the length of the break entirely — which is
          usually the thing anyone looking at this actually wants to know.
        */}
        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Check-in</dt>
            <dd className="font-medium tabular-nums">{time(day.check_in_at)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lunch in</dt>
            <dd className="font-medium tabular-nums">
              {time(day.lunch_started_at)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lunch out</dt>
            <dd className="font-medium tabular-nums">
              {time(day.lunch_verified_at)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Check-out</dt>
            <dd className="font-medium tabular-nums">{time(day.check_out_at)}</dd>
          </div>
        </dl>

        {ordered.length > 0 && (
          <ul className="space-y-2">
            {ordered.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                timezone={timezone}
                auditNotice={auditNotice}
                ownerName={ownerName}
                deletable={deletable}
              />
            ))}
          </ul>
        )}

        {lunchProof && lunchProofViewable && (
          <div className="space-y-1.5 rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Utensils className="size-3.5 shrink-0" aria-hidden />
              Lunch proof video
              {lunchProof.duration_s && (
                <span className="font-normal text-muted-foreground">
                  · {Math.round(lunchProof.duration_s)}s
                </span>
              )}
            </p>
            <MediaViewer
              kind="video"
              id={lunchProof.id}
              alt={`${ownerName} ki lunch proof video`}
              auditNotice={auditNotice}
            />
          </div>
        )}

        {deletable && (
          <DeleteEntry
            kind="day"
            id={day.id}
            what={formatCalendarDate(day.attendance_date)}
          />
        )}
      </CardContent>
    </Card>
  );
}
