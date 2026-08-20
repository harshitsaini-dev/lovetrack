"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import {
  deleteAttendanceDay,
  deleteAttendanceEvent,
} from "@/lib/admin/actions";
import type { AuthFormState } from "@/lib/auth/actions";

/**
 * Deleting a wrong entry.
 *
 * Two steps on purpose. The first click only reveals the form; the reason
 * has to be typed before anything can happen. This is not ceremony — the
 * reason is what the audit log stores alongside the deleted row, and a
 * one-tap delete would make an honest correction and a quiet cover-up
 * indistinguishable after the fact.
 *
 * It is also irreversible, and sits next to buttons that merely open a
 * photo, so it should not be reachable by the same single tap.
 */
export function DeleteEntry({
  kind,
  id,
  what,
}: {
  kind: "event" | "day";
  id: string;
  /** Named in the confirmation, so nobody deletes the wrong row. */
  what: string;
}) {
  const [state, submit] = useActionState<AuthFormState, FormData>(
    kind === "event" ? deleteAttendanceEvent : deleteAttendanceDay,
    null,
  );
  useRefreshOnSuccess(state);

  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="touch-target w-full text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-4" aria-hidden />
        {kind === "day" ? "Poora din delete karein" : "Ye entry delete karein"}
      </Button>
    );
  }

  const fieldName = kind === "event" ? "eventId" : "attendanceId";

  return (
    <form action={submit} className="space-y-2 rounded-lg border border-destructive/40 p-3">
      <input type="hidden" name={fieldName} value={id} />

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{what}</span> delete hoga.
        Ye wapas nahi aayega
        {kind === "day" && " — is din ki saari entries aur video bhi jayengi"}.
      </p>

      <FormMessage state={state} />

      <div className="space-y-1.5">
        <Label htmlFor={`reason-${id}`} className="text-xs">
          Wajah (audit log me jayegi)
        </Label>
        <Input
          id={`reason-${id}`}
          name="reason"
          required
          minLength={3}
          maxLength={300}
          placeholder="Galti se do baar check-in ho gaya tha"
          className="h-10 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="touch-target flex-1"
          onClick={() => setConfirming(false)}
        >
          Rehne dein
        </Button>
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          className="touch-target flex-1"
        >
          Delete karein
        </Button>
      </div>
    </form>
  );
}
