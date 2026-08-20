"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, HardDrive, Loader2, Trash2 } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  runCleanup,
  updateRetentionSettings,
  type RetentionPreview,
  type RetentionResult,
} from "@/lib/admin/retention";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

export function RetentionPanel({ preview }: { preview: RetentionPreview }) {
  const router = useRouter();

  const [settingsState, saveSettings] = useActionState<
    RetentionResult | null,
    FormData
  >(updateRetentionSettings, null);

  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<RetentionResult | null>(null);
  const [running, startCleanup] = useTransition();

  const nothingToDo =
    preview.photos === 0 && preview.clips === 0 && preview.attendance_rows === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle
            role="heading"
            aria-level={2}
            className="flex items-center gap-2 text-base"
          >
            <HardDrive className="size-4 text-primary" aria-hidden />
            Abhi kya purana hai
          </CardTitle>
          <CardDescription>
            Retention settings ke hisaab se in cheezon ki umar poori ho chuki
            hai.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Photos</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {preview.photos}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Lunch clips</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {preview.clips}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Records</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {preview.attendance_rows}
              </dd>
            </div>
          </dl>

          {preview.clip_bytes > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Lagbhag{" "}
              <strong className="font-medium text-foreground">
                {formatBytes(preview.clip_bytes)}
              </strong>{" "}
              video storage free hogi.
            </p>
          )}

          {preview.media_cutoff && (
            <p className="text-center text-xs text-muted-foreground">
              {preview.media_cutoff} se purani media
              {preview.record_cutoff
                ? ` · ${preview.record_cutoff} se purane records`
                : " · records rakhe jayenge"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle
            role="heading"
            aria-level={2}
            className="flex items-center gap-2 text-base"
          >
            <Trash2 className="size-4 text-destructive" aria-hidden />
            Cleanup chalayein
          </CardTitle>
          <CardDescription>
            Media delete hoti hai, record nahi. Har event ka time, location
            aur verdict waisa hi rehta hai — sirf photo ya video hat jaati
            hai.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {result && <FormMessage state={result} />}

          {nothingToDo ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              Abhi kuch purana nahi hai.
            </p>
          ) : confirming ? (
            <div className="space-y-3">
              {/*
                Deleting someone else's evidence is not a thing to do behind
                a single tap, so the numbers are restated at the moment of
                confirming rather than only on the card above.
              */}
              <Alert variant="destructive">
                <AlertTriangle className="size-4" aria-hidden />
                <AlertDescription>
                  {preview.photos} photos aur {preview.clips} videos hamesha ke
                  liye delete ho jayengi. Ye wapas nahi aayengi.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  className="touch-target flex-1"
                  disabled={running}
                  onClick={() =>
                    startCleanup(async () => {
                      const outcome = await runCleanup();
                      setResult(outcome);
                      setConfirming(false);
                      router.refresh();
                    })
                  }
                >
                  {running ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Delete ho raha hai…
                    </>
                  ) : (
                    "Haan, delete karein"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="touch-target flex-1"
                  disabled={running}
                  onClick={() => setConfirming(false)}
                >
                  Rehne dein
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="touch-target w-full"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              Purani media delete karein
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Retention settings
          </CardTitle>
          <CardDescription>
            0 ka matlab hai kabhi delete na karein.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form action={saveSettings} className="space-y-4" noValidate>
            <FormMessage state={settingsState} />

            <div className="space-y-2">
              <Label htmlFor="mediaRetentionDays">Media kitne din rakhein</Label>
              <Input
                id="mediaRetentionDays"
                name="mediaRetentionDays"
                type="number"
                min={0}
                max={3650}
                defaultValue={preview.media_retention_days}
                className="h-11"
                aria-describedby="media-hint"
              />
              <p id="media-hint" className="text-xs text-muted-foreground">
                Photos aur lunch videos. Free tier bharne se yahi bachata hai.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recordRetentionDays">
                Attendance records kitne din rakhein
              </Label>
              <Input
                id="recordRetentionDays"
                name="recordRetentionDays"
                type="number"
                min={0}
                max={3650}
                defaultValue={preview.record_retention_days}
                className="h-11"
                aria-describedby="record-hint"
              />
              <p id="record-hint" className="text-xs text-muted-foreground">
                Records chhote hote hain aur user ki apni history hain —
                default 0 (hamesha rakhein).
              </p>
            </div>

            <SubmitButton pendingLabel="Save ho raha hai...">
              Settings save karein
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
