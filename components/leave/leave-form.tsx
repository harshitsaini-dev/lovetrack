"use client";

import { useActionState } from "react";
import { CalendarPlus } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import type { AuthFormState } from "@/lib/auth/actions";
import { applyForLeave } from "@/lib/leave/actions";
import { LEAVE_TYPE_LABELS, LEAVE_TYPES } from "@/lib/leave/constants";

export function LeaveForm({ today }: { today: string }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    applyForLeave,
    null,
  );
  useRefreshOnSuccess(state);

  return (
    <Card>
      <CardHeader>
        <CardTitle
          role="heading"
          aria-level={2}
          className="flex items-center gap-2 text-base"
        >
          <CalendarPlus className="size-4 text-primary" aria-hidden />
          Leave mark karein
        </CardTitle>
        <CardDescription>
          Ye sirf jaankari hai — kisi ki approval nahi chahiye. Us din koi
          reminder nahi aayega.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* key clears the fields once a request goes through. */}
        <form
          key={state?.ok ? "submitted" : "editing"}
          action={formAction}
          className="space-y-4"
          noValidate
        >
          <FormMessage state={state} />

          <div className="space-y-2">
            <Label htmlFor="leaveDate">Kis din ki</Label>
            <Input
              id="leaveDate"
              name="leaveDate"
              type="date"
              defaultValue={today}
              required
              className="h-11"
              aria-describedby="date-hint"
            />
            <p id="date-hint" className="text-xs text-muted-foreground">
              Pichhle 7 din tak ki leave apply kar sakte hain.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leaveType">Type</Label>
            <select
              id="leaveType"
              name="leaveType"
              defaultValue="casual"
              className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {LEAVE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LEAVE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <textarea
              id="reason"
              name="reason"
              rows={3}
              required
              minLength={3}
              maxLength={500}
              placeholder="Chhoti si wajah likhein"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          <SubmitButton pendingLabel="Save ho raha hai...">
            Leave mark karein
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
