"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { AlertTriangle, Eye, Loader2, MapPin } from "lucide-react";

import { LocationMap } from "@/components/location/location-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getEvidenceUrl } from "@/lib/admin/actions";
import type { FlaggedEvent } from "@/lib/admin/queries";
import { describeSignal, EVENT_LABELS } from "@/lib/attendance/messages";
import { formatFullDate, formatTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

export function FlaggedEventCard({ event }: { event: FlaggedEvent }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const rejected = event.status === "rejected";

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {event.full_name ?? event.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {event.email}
            </p>
          </div>

          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              rejected
                ? "bg-destructive/10 text-destructive"
                : "bg-status-warn/10 text-status-warn",
            )}
          >
            {event.status} · {event.risk_score}
          </span>
        </div>

        <p className="text-sm">
          {EVENT_LABELS[event.event_type]} ·{" "}
          <span className="text-muted-foreground">
            {formatFullDate(event.server_timestamp)}{" "}
            {formatTime(event.server_timestamp)}
          </span>
        </p>

        {/*
          The signals, not just the number. A score presented on its own
          asks a reviewer to take it on faith; these say what the engine
          actually noticed.
        */}
        {event.signals.length > 0 && (
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              Kya notice hua
            </p>
            <ul className="mt-1.5 space-y-1">
              {event.signals.map((signal, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  • {describeSignal(signal)} ({signal.points})
                </li>
              ))}
            </ul>
          </div>
        )}

        {event.place_label && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {event.place_label}
            {event.accuracy_m !== null && ` · ±${Math.round(event.accuracy_m)}m`}
          </p>
        )}

        {event.device_label && (
          <p className="text-xs text-muted-foreground">{event.device_label}</p>
        )}

        {event.latitude !== null && event.longitude !== null && (
          <LocationMap
            points={[
              {
                latitude: event.latitude,
                longitude: event.longitude,
                accuracyM: event.accuracy_m,
                label: event.place_label,
              },
            ]}
            className="h-36"
          />
        )}

        {event.photo_path && !photoUrl && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="touch-target w-full"
              disabled={loading}
              onClick={() =>
                startLoading(async () => {
                  setError(null);
                  const result = await getEvidenceUrl(
                    "attendance-media",
                    event.photo_path!,
                    event.user_id,
                  );
                  if (result.ok) setPhotoUrl(result.url);
                  else setError(result.error);
                })
              }
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Khul rahi hai…
                </>
              ) : (
                <>
                  <Eye className="size-4" aria-hidden />
                  Photo dekhein
                </>
              )}
            </Button>

            {/*
              Said plainly, before the click rather than after. Opening
              somebody's photograph is recorded against your name.
            */}
            <p className="text-center text-xs text-muted-foreground">
              Photo kholna audit log me record hoga.
            </p>
          </>
        )}

        {photoUrl && (
          <Image
            src={photoUrl}
            alt={`${event.full_name ?? event.email} ki ${EVENT_LABELS[event.event_type]} photo`}
            width={720}
            height={960}
            unoptimized
            className="w-full rounded-xl object-cover"
          />
        )}

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
