"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, SwitchCamera } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  captureFrame,
  getCameraErrorMessage,
  openCamera,
  stopCamera,
  type FacingMode,
} from "@/lib/media/capture";
import { cn } from "@/lib/utils";

type CameraCaptureProps = {
  /** Shown over the preview — the phrase the user must be holding/saying. */
  challenge?: string;
  onCaptured: (blob: Blob, previewUrl: string) => void;
  disabled?: boolean;
};

/**
 * Live camera preview with a shutter.
 *
 * There is deliberately no file input fallback. If the camera cannot be
 * opened the flow stops here with an explanation, because falling back to
 * "pick an image" would hand back exactly the capability the whole
 * anti-fraud design removes.
 */
export function CameraCapture({
  challenge,
  onCaptured,
  disabled,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<FacingMode>("user");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError(null);
      setReady(false);

      try {
        const stream = await openCamera(facing);

        if (cancelled) {
          stopCamera(stream);
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setError(getCameraErrorMessage(err));
      }
    }

    start();

    return () => {
      cancelled = true;
      stopCamera(streamRef.current);
      streamRef.current = null;
    };
  }, [facing]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !ready) return;

    setBusy(true);
    try {
      const blob = await captureFrame(videoRef.current);
      onCaptured(blob, URL.createObjectURL(blob));
    } catch (err) {
      setError(getCameraErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [onCaptured, ready]);

  if (error) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed p-6 text-center">
        <Camera className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          onClick={() => setFacing((f) => f)}
        >
          <RefreshCw className="size-4" aria-hidden />
          Dobara try karein
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-muted">
        <video
          ref={videoRef}
          playsInline
          muted
          // Front camera preview is mirrored, matching every other selfie UI.
          // The captured frame is not, so the photo reads correctly.
          className={cn(
            "aspect-[3/4] w-full object-cover",
            facing === "user" && "-scale-x-100",
          )}
        />

        {challenge && (
          <div className="absolute inset-x-0 top-0 p-3">
            <p className="rounded-lg bg-black/60 px-3 py-2 text-center text-sm font-medium text-white backdrop-blur">
              {challenge}
            </p>
          </div>
        )}

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Camera khul raha hai…</p>
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute right-3 bottom-3 touch-target rounded-full"
          aria-label="Camera badlein"
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
        >
          <SwitchCamera className="size-4" aria-hidden />
        </Button>
      </div>

      <Button
        type="button"
        size="lg"
        className="touch-target h-12 w-full"
        disabled={!ready || busy || disabled}
        onClick={handleCapture}
      >
        <Camera className="size-4" aria-hidden />
        {busy ? "Capture ho raha hai…" : "Photo capture karein"}
      </Button>
    </div>
  );
}
