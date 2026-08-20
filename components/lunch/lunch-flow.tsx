"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw, Utensils } from "lucide-react";

import { VideoRecorder } from "@/components/lunch/video-recorder";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Challenge } from "@/lib/attendance/challenge";
import { recordLunchProof } from "@/lib/lunch/actions";
import { getLunchErrorMessage } from "@/lib/lunch/messages";
import { uploadLunchProof } from "@/lib/media/upload";
import type { RecordingResult } from "@/lib/media/record";

type Stage = "record" | "review" | "uploading" | "done";

/**
 * The lunch proof step.
 *
 * By the time this renders, lunch_start and lunch_end have already gone
 * through the attendance engine with their own camera and location capture.
 * What is left is the clip that says what was actually eaten.
 */
export function LunchFlow({
  userId,
  challenge,
}: {
  userId: string;
  challenge: Challenge;
}) {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("record");
  const [clip, setClip] = useState<{
    result: RecordingResult;
    url: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRecorded = useCallback(
    (result: RecordingResult, url: string) => {
      setClip({ result, url });
      setError(null);
      setStage("review");
    },
    [],
  );

  const reset = useCallback(() => {
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setError(null);
    setStage("record");
  }, [clip]);

  const handleSubmit = useCallback(async () => {
    if (!clip) return;

    setStage("uploading");
    setError(null);

    const path = await uploadLunchProof(
      userId,
      clip.result.blob,
      clip.result.mimeType,
    );

    if (!path) {
      setError("Video upload nahi ho payi. Network check karke dobara try karein.");
      setStage("review");
      return;
    }

    const outcome = await recordLunchProof({
      videoPath: path,
      durationS: Number(clip.result.durationS.toFixed(2)),
      sizeBytes: clip.result.blob.size,
      challengePhrase: challenge.overlay,
    });

    if (!outcome.ok) {
      setError(getLunchErrorMessage(outcome.error));
      setStage("review");
      return;
    }

    setStage("done");
  }, [clip, userId, challenge]);

  if (stage === "done") {
    return (
      <Card>
        <CardContent className="space-y-4 py-6 text-center">
          <CheckCircle2
            className="mx-auto size-10 text-status-active"
            aria-hidden
          />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Lunch proof save ho gaya</h2>
            <p className="text-sm text-muted-foreground">
              Video private hai. Partner ise tabhi dekh sakte hain jab aap
              Settings me lunch proof sharing on karein.
            </p>
          </div>

          <Button
            type="button"
            className="touch-target w-full"
            onClick={() => router.push("/app/dashboard")}
          >
            Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage === "record") {
    return (
      <div className="space-y-4">
        <Alert>
          <Utensils className="size-4" aria-hidden />
          <AlertDescription>{challenge.instruction}</AlertDescription>
        </Alert>

        <VideoRecorder
          challenge={challenge.overlay}
          onRecorded={handleRecorded}
        />

        <p className="text-center text-xs text-muted-foreground">
          Sirf live recording — gallery se video choose karne ka option nahi hai.
        </p>
      </div>
    );
  }

  const uploading = stage === "uploading";

  return (
    <div className="space-y-4">
      {clip && (
        <video
          src={clip.url}
          controls
          playsInline
          className="aspect-[3/4] w-full rounded-xl bg-muted object-cover"
        />
      )}

      {clip && (
        <p className="text-center text-xs text-muted-foreground">
          {clip.result.durationS.toFixed(1)}s ·{" "}
          {(clip.result.blob.size / 1024 / 1024).toFixed(1)} MB
        </p>
      )}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="touch-target flex-1"
          disabled={uploading}
          onClick={reset}
        >
          <RotateCcw className="size-4" aria-hidden />
          Dobara record karein
        </Button>

        <Button
          type="button"
          className="touch-target flex-[2]"
          disabled={uploading}
          onClick={handleSubmit}
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Upload ho raha hai…
            </>
          ) : (
            "Proof submit karein"
          )}
        </Button>
      </div>
    </div>
  );
}
