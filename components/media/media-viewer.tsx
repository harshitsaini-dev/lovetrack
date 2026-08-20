"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Eye, Loader2, Play, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getAttendancePhotoUrl,
  getLunchVideoUrl,
} from "@/lib/media/view";

type Props = {
  kind: "photo" | "video";
  /** Attendance event id for a photo, lunch proof id for a clip. */
  id: string;
  /** Describes what is being opened, for screen readers. */
  alt: string;
  /**
   * Shown before the click when opening this is recorded against the
   * viewer. Said up front rather than after, because afterwards is too
   * late to decide not to look.
   */
  auditNotice?: boolean;
  label?: string;
};

/**
 * Loads media behind a deliberate click.
 *
 * Nothing is fetched on render. Signed URLs are short-lived, so a page that
 * minted one for every event would spend most of them on media nobody
 * opened — and would quietly put somebody's face on screen the moment a
 * partner glanced at the feed. Opening a photograph should be an act, not
 * a side effect of scrolling.
 */
export function MediaViewer({ kind, id, alt, auditNotice, label }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, start] = useTransition();

  if (url) {
    return kind === "photo" ? (
      <Image
        src={url}
        alt={alt}
        width={720}
        height={720}
        // Signed URLs are not on a configured image host and expire, so
        // Next's optimiser would both fail to fetch them and cache a URL
        // that stops working.
        unoptimized
        className="w-full rounded-lg border object-cover"
      />
    ) : (
      <video
        src={url}
        controls
        playsInline
        // No autoplay: a clip of someone eating should not start talking
        // the instant it loads.
        className="w-full rounded-lg border bg-black"
        aria-label={alt}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="touch-target w-full"
        disabled={loading}
        onClick={() =>
          start(async () => {
            setError(null);
            const result =
              kind === "photo"
                ? await getAttendancePhotoUrl(id)
                : await getLunchVideoUrl(id);

            if (result.ok) setUrl(result.url);
            else setError(result.error);
          })
        }
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Khul raha hai…
          </>
        ) : (
          <>
            {kind === "photo" ? (
              <Eye className="size-4" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )}
            {label ?? (kind === "photo" ? "Photo dekhein" : "Video dekhein")}
          </>
        )}
      </Button>

      {auditNotice && !error && (
        <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
          <ShieldAlert className="size-3 shrink-0" aria-hidden />
          Kholna audit log me record hoga.
        </p>
      )}

      {error && (
        <p role="alert" className="text-center text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
