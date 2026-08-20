"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { CameraCapture } from "@/components/camera/camera-capture";
import { LocationMap } from "@/components/location/location-map";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  issueNonce,
  lookupPlaceName,
  submitAttendanceEvent,
} from "@/lib/attendance/actions";
import {
  describeSignal,
  EVENT_LABELS,
  getAttendanceErrorMessage,
} from "@/lib/attendance/messages";
import {
  captureLocation,
  getLocationErrorMessage,
  type CapturedLocation,
} from "@/lib/location/capture";
import type { Challenge } from "@/lib/attendance/challenge";
import { uploadAttendancePhoto } from "@/lib/media/upload";
import type {
  AttendanceEventType,
  RecordEventResult,
} from "@/types/attendance";

type Stage = "capture" | "confirm" | "submitting" | "done";

type CaptureFlowProps = {
  userId: string;
  eventType: AttendanceEventType;
  challenge: Challenge;
};

function deviceLabel(): string {
  if (typeof navigator === "undefined") return "unknown";
  // Enough to notice "this account suddenly moved to another device",
  // without attempting a fingerprint.
  const ua = navigator.userAgent;
  const platform = /android/i.test(ua)
    ? "Android"
    : /iphone|ipad|ipod/i.test(ua)
      ? "iOS"
      : /windows/i.test(ua)
        ? "Windows"
        : /mac/i.test(ua)
          ? "macOS"
          : "Other";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome|crios/i.test(ua)
      ? "Chrome"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /safari/i.test(ua)
          ? "Safari"
          : "Browser";
  return `${platform} · ${browser}`;
}

export function CaptureFlow({
  userId,
  eventType,
  challenge,
}: CaptureFlowProps) {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("capture");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecordEventResult | null>(null);

  const resolveLocation = useCallback(() => {
    setError(null);
    setPlace(null);

    captureLocation()
      .then((fix) => {
        setLocation(fix);
        // Show the user a place name, not coordinates. Best-effort: if the
        // lookup fails we simply say nothing rather than blocking.
        lookupPlaceName(fix.latitude, fix.longitude).then(setPlace);
      })
      .catch((err) => setError(getLocationErrorMessage(err)));
  }, []);

  const handleCaptured = useCallback(
    (blob: Blob, url: string) => {
      setPhoto({ blob, url });
      setStage("confirm");

      // Ask for the fix now rather than at submit time: the reading must be
      // seconds old when the server sees it, and this also surfaces a denied
      // permission while the user can still do something about it.
      resolveLocation();
    },
    [resolveLocation],
  );

  const reset = useCallback(() => {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setLocation(null);
    setPlace(null);
    setError(null);
    setResult(null);
    setStage("capture");
  }, [photo]);

  const handleSubmit = useCallback(async () => {
    if (!photo || !location) return;

    setStage("submitting");
    setError(null);

    // The nonce is issued here, not on page load: it lives three minutes,
    // and a user who leaves the page open would otherwise find it expired.
    const nonce = await issueNonce(eventType);

    if (!nonce.ok) {
      setError(getAttendanceErrorMessage(nonce.error));
      setStage("confirm");
      return;
    }

    const photoPath = await uploadAttendancePhoto(userId, eventType, photo.blob);

    const outcome = await submitAttendanceEvent({
      nonce: nonce.nonce,
      eventType,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyM: location.accuracyM,
      fixAgeS: location.fixAgeS,
      photoPath,
      placeLabel: null,
      deviceLabel: deviceLabel(),
    });

    setResult(outcome);
    setStage("done");

    // Deliberately no router.refresh() here. Refreshing re-runs this page's
    // Server Component, which now sees the day has moved on and redirects to
    // the dashboard — yanking the result screen away before the user has
    // read it, risk signals and all. The action already revalidated the
    // cache, so the dashboard is fresh when they choose to go there.
  }, [photo, location, eventType, userId]);

  // ---------- done ----------
  if (stage === "done" && result) {
    const rejected = !result.ok;
    const flagged = result.ok && result.status === "flagged";

    return (
      <Card>
        <CardContent className="space-y-4 py-6 text-center">
          {rejected ? (
            <AlertTriangle className="mx-auto size-10 text-destructive" aria-hidden />
          ) : flagged ? (
            <AlertTriangle className="mx-auto size-10 text-status-warn" aria-hidden />
          ) : (
            <CheckCircle2 className="mx-auto size-10 text-status-active" aria-hidden />
          )}

          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              {rejected
                ? "Verification fail ho gaya"
                : flagged
                  ? `${EVENT_LABELS[eventType]} record ho gaya — review ke liye flag`
                  : `${EVENT_LABELS[eventType]} ho gaya`}
            </h2>

            <p className="text-sm text-muted-foreground">
              {rejected
                ? getAttendanceErrorMessage(
                    "error" in result ? result.error : null,
                  )
                : flagged
                  ? "Record ho gaya hai, par kuch signals unusual lage. Admin review kar sakte hain."
                  : "Aapka record server ke time ke saath save ho gaya hai."}
            </p>
          </div>

          {result.signals && result.signals.length > 0 && (
            <div className="rounded-lg bg-muted/60 p-3 text-left">
              <p className="text-xs font-medium">Kya notice hua</p>
              <ul className="mt-1.5 space-y-1">
                {result.signals.map((signal, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    • {describeSignal(signal)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            {rejected && (
              <Button
                type="button"
                variant="outline"
                className="touch-target flex-1"
                onClick={reset}
              >
                <RotateCcw className="size-4" aria-hidden />
                Dobara try karein
              </Button>
            )}
            <Button
              type="button"
              className="touch-target flex-1"
              onClick={() => router.push("/app/dashboard")}
            >
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---------- capture ----------
  if (stage === "capture") {
    return (
      <div className="space-y-4">
        <Alert>
          <ShieldCheck className="size-4" aria-hidden />
          <AlertDescription>{challenge.instruction}</AlertDescription>
        </Alert>

        <CameraCapture
          challenge={challenge.overlay}
          onCaptured={handleCaptured}
        />

        <p className="text-center text-xs text-muted-foreground">
          Sirf live camera — gallery se photo choose karne ka option nahi hai.
        </p>
      </div>
    );
  }

  // ---------- confirm ----------
  const submitting = stage === "submitting";

  return (
    <div className="space-y-4">
      {photo && (
        <div className="overflow-hidden rounded-xl bg-muted">
          <Image
            src={photo.url}
            alt="Abhi capture ki gayi photo"
            width={720}
            height={960}
            unoptimized
            className="aspect-[3/4] w-full object-cover"
          />
        </div>
      )}

      <Card>
        <CardContent className="space-y-2 py-4">
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              {location ? (
                <>
                  <p className="font-medium">
                    {place ?? "Location mil gayi"}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {location.latitude.toFixed(5)},{" "}
                    {location.longitude.toFixed(5)} · ±
                    {Math.round(location.accuracyM)}m
                  </p>
                </>
              ) : error ? (
                <p className="text-destructive">{error}</p>
              ) : (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Location li ja rahi hai…
                </p>
              )}
            </div>
          </div>

          {location && (
            <LocationMap
              points={[
                {
                  latitude: location.latitude,
                  longitude: location.longitude,
                  accuracyM: location.accuracyM,
                  label: place,
                },
              ]}
            />
          )}

          <p className="pt-1 text-xs text-muted-foreground">
            Time server se liya jaayega — aapke device ka clock use nahi hota.
          </p>
        </CardContent>
      </Card>

      {error && location === null && stage !== "submitting" && (
        <Button
          type="button"
          variant="outline"
          className="touch-target w-full"
          onClick={resolveLocation}
        >
          <RotateCcw className="size-4" aria-hidden />
          Location dobara try karein
        </Button>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="touch-target flex-1"
          disabled={submitting}
          onClick={reset}
        >
          Photo badlein
        </Button>

        <Button
          type="button"
          className="touch-target flex-[2]"
          disabled={!location || submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Verify ho raha hai…
            </>
          ) : (
            <>Verify &amp; {EVENT_LABELS[eventType]}</>
          )}
        </Button>
      </div>
    </div>
  );
}
