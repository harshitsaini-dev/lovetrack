"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setAvatar } from "@/lib/profile/actions";
import { uploadAvatar } from "@/lib/media/upload";
import type { Profile } from "@/types/database";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function initials(profile: Profile): string {
  const source = profile.full_name?.trim() || profile.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Profile picture.
 *
 * A file input is right here, unlike anywhere in the attendance flow: this
 * is an avatar, not evidence, and choosing an existing photo is exactly
 * what people expect.
 */
export function AvatarPicker({ profile }: { profile: Profile }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(profile.avatar_url);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("JPG, PNG ya WebP image chunein.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image 2MB se chhoti honi chahiye.");
      return;
    }

    // Show it immediately; the upload catches up.
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    startTransition(async () => {
      const url = await uploadAvatar(profile.id, file, file.type);

      if (!url) {
        setError("Upload nahi ho payi. Dobara try karein.");
        setPreview(profile.avatar_url);
        return;
      }

      const result = await setAvatar(url);

      if (result && !result.ok) {
        setError(result.error);
        setPreview(profile.avatar_url);
        return;
      }

      setPreview(url);
      router.refresh();
    });
  }

  function handleRemove() {
    setError(null);
    setPreview(null);

    startTransition(async () => {
      const result = await setAvatar(null);
      if (result && !result.ok) {
        setError(result.error);
        setPreview(profile.avatar_url);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        {/*
          shadcn's CardTitle is a plain div. These titles head a section of
          the page, so they are given heading semantics explicitly —
          otherwise a screen reader gets a flat wall of controls with no
          structure to navigate by.
        */}
        <CardTitle
          role="heading"
          aria-level={2}
          className="flex items-center gap-2 text-base"
        >
          <Camera className="size-4 text-primary" aria-hidden />
          Profile photo
        </CardTitle>
        <CardDescription>
          Aapke partner aur admin ko yahi dikhegi.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          {preview ? (
            <Image
              src={preview}
              alt="Aapki profile photo"
              width={72}
              height={72}
              unoptimized
              className="size-18 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar className="size-18 shrink-0">
              <AvatarFallback className="bg-accent text-lg text-accent-foreground">
                {initials(profile)}
              </AvatarFallback>
            </Avatar>
          )}

          <div className="flex flex-1 flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Save ho raha hai…
                </>
              ) : (
                <>
                  <Camera className="size-4" aria-hidden />
                  {preview ? "Photo badlein" : "Photo chunein"}
                </>
              )}
            </Button>

            {preview && (
              <Button
                type="button"
                variant="ghost"
                className="touch-target text-muted-foreground"
                disabled={pending}
                onClick={handleRemove}
              >
                <Trash2 className="size-4" aria-hidden />
                Hatayein
              </Button>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          aria-label="Profile photo chunein"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
            // Reset so picking the same file twice still fires a change.
            event.target.value = "";
          }}
        />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
