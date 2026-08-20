"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Square, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getCameraErrorMessage,
  openCamera,
  stopCamera,
} from "@/lib/media/capture";
import {
  isRecordingSupported,
  LUNCH_MAX_SECONDS,
  LUNCH_MIN_SECONDS,
  LunchRecorder,
  type RecordingResult,
} from "@/lib/media/record";

type VideoRecorderProps = {
  challenge: string;
  onRecorded: (result: RecordingResult, previewUrl: string) => void;
};

/**
 * Records the lunch proof clip.
 *
 * Rear camera by default — the point is to show the food, not the face.
 * Audio is captured so the challenge phrase can be spoken rather than held
 * up, which is easier one-handed.
 */
export function VideoRecorder({ challenge, onRecorded }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<LunchRecorder | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!isRecordingSupported()) {
        setError("Aapka browser video recording support nahi karta.");
        return;
      }

      try {
        const base = await openCamera("environment");

        // openCamera deliberately asks for video only; the clip needs audio
        // too, so the microphone track is added here.
        let stream = base;
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream = new MediaStream([
            ...base.getVideoTracks(),
            ...mic.getAudioTracks(),
          ]);
        } catch {
          // No microphone, or permission refused. A silent clip still shows
          // the meal and the phrase can be held up instead.
        }

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
  }, []);

  const handleStart = useCallback(() => {
    if (!streamRef.current) return;

    // The recorder reports completion the same way whether the user stopped
    // it or the time limit did, so there is no clock to watch here.
    const recorder = new LunchRecorder(streamRef.current, {
      onTick: setElapsed,
      onComplete: (result) => {
        setRecording(false);
        onRecorded(result, URL.createObjectURL(result.blob));
      },
      onError: () => {
        setRecording(false);
        setError("Recording save nahi ho payi. Dobara try karein.");
      },
    });

    recorderRef.current = recorder;

    try {
      recorder.start();
      setRecording(true);
      setElapsed(0);
    } catch {
      setError("Recording shuru nahi ho payi.");
    }
  }, [onRecorded]);

  const handleStop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  if (error) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed p-6 text-center">
        <Video className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const longEnough = elapsed >= LUNCH_MIN_SECONDS;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-muted">
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-[3/4] w-full object-cover"
        />

        <div className="absolute inset-x-0 top-0 p-3">
          <p className="rounded-lg bg-black/60 px-3 py-2 text-center text-sm font-medium text-white backdrop-blur">
            Khana dikhayein aur bolein: {challenge}
          </p>
        </div>

        {recording && (
          <div className="absolute top-16 left-3 flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1">
            <Circle
              className="size-2 animate-pulse fill-white text-white"
              aria-hidden
            />
            <span className="text-xs font-medium tabular-nums text-white">
              {elapsed.toFixed(1)}s
            </span>
          </div>
        )}

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Camera khul raha hai…</p>
          </div>
        )}
      </div>

      {recording && (
        <div className="space-y-1">
          <Progress
            value={(elapsed / LUNCH_MAX_SECONDS) * 100}
            aria-label="Recording ka time"
          />
          <p className="text-center text-xs text-muted-foreground">
            {longEnough
              ? `Ab rok sakte hain · max ${LUNCH_MAX_SECONDS}s`
              : `Kam se kam ${LUNCH_MIN_SECONDS}s`}
          </p>
        </div>
      )}

      {recording ? (
        <Button
          type="button"
          size="lg"
          variant={longEnough ? "default" : "outline"}
          disabled={!longEnough}
          className="touch-target h-12 w-full"
          onClick={handleStop}
        >
          <Square className="size-4" aria-hidden />
          {longEnough
            ? "Recording rokein"
            : `${Math.ceil(LUNCH_MIN_SECONDS - elapsed)}s aur…`}
        </Button>
      ) : (
        <Button
          type="button"
          size="lg"
          disabled={!ready}
          className="touch-target h-12 w-full"
          onClick={handleStart}
        >
          <Video className="size-4" aria-hidden />
          Recording shuru karein
        </Button>
      )}
    </div>
  );
}
