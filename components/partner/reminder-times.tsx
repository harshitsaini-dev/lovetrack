"use client";

import { useActionState } from "react";
import { BellRing } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import type { AuthFormState } from "@/lib/auth/actions";
import { setPartnerReminderTimes } from "@/lib/pairing/actions";
import { toTimeInputValue } from "@/lib/validation/profile";

/**
 * Setting when a friend gets nudged.
 *
 * This is the only control on the partner screen that writes to somebody
 * else's account, so it says so plainly rather than sitting quietly among
 * the sharing switches. Their settings screen names whoever set the times,
 * and they can change them back — a schedule that moves with no explanation
 * reads as a broken phone, not as a friend helping.
 */
export function ReminderTimes({
  partnerId,
  partnerName,
  checkIn,
  checkOut,
}: {
  partnerId: string;
  partnerName: string;
  checkIn: string;
  checkOut: string;
}) {
  const [state, submit] = useActionState<AuthFormState, FormData>(
    setPartnerReminderTimes,
    null,
  );
  useRefreshOnSuccess(state);

  const firstName = partnerName.split(" ")[0];

  return (
    <form action={submit} className="space-y-3 rounded-lg border p-3">
      <input type="hidden" name="userId" value={partnerId} />

      <div className="flex items-start gap-2.5">
        <BellRing className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium">{firstName} ke reminders</p>
          <p className="text-xs text-muted-foreground">
            Agar in times tak unhone mark nahi kiya, toh unhe email jayegi.
            {firstName} ko dikhega ki ye aapne set kiya hai, aur wo ise badal
            bhi sakte hain.
          </p>
        </div>
      </div>

      <FormMessage state={state} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`checkIn-${partnerId}`} className="text-xs">
            Check-in tak
          </Label>
          <Input
            id={`checkIn-${partnerId}`}
            name="checkIn"
            type="time"
            defaultValue={toTimeInputValue(checkIn)}
            required
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`checkOut-${partnerId}`} className="text-xs">
            Check-out tak
          </Label>
          <Input
            id={`checkOut-${partnerId}`}
            name="checkOut"
            type="time"
            defaultValue={toTimeInputValue(checkOut)}
            required
            className="h-11"
          />
        </div>
      </div>

      {/* Their timezone, not yours — 09:00 means 09:00 where they are. */}
      <p className="text-xs text-muted-foreground">
        Ye {firstName} ke timezone ke local time hain.
      </p>

      <SubmitButton pendingLabel="Save ho raha hai...">
        Reminder times save karein
      </SubmitButton>
    </form>
  );
}
