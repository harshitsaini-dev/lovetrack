"use client";

import { useActionState } from "react";
import { CalendarDays } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import type { AuthFormState } from "@/lib/auth/actions";
import { withdrawLeave } from "@/lib/leave/actions";
import { LEAVE_TYPE_LABELS } from "@/lib/leave/constants";
import type { LeaveEntry } from "@/lib/leave/queries";
import { formatCalendarDate } from "@/lib/format/datetime";

function LeaveRow({ leave }: { leave: LeaveEntry }) {
  const [state, withdraw] = useActionState<AuthFormState, FormData>(
    withdrawLeave,
    null,
  );
  useRefreshOnSuccess(state);

  const withdrawn = leave.status === "cancelled";

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium">{formatCalendarDate(leave.leave_date)}</p>
          {withdrawn && (
            <p className="text-xs text-muted-foreground">Hata di gayi</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {LEAVE_TYPE_LABELS[leave.leave_type]}
        </p>

        <p className="text-pretty text-sm">{leave.reason}</p>

        <FormMessage state={state} />

        {/*
          Withdrawing is the only change anyone can make, and only while the
          entry still stands. The reason cannot be edited after the fact —
          otherwise "what I said on the day" would be rewritable later.
        */}
        {!withdrawn && (
          <form action={withdraw}>
            <input type="hidden" name="leaveId" value={leave.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="touch-target text-muted-foreground"
            >
              Hatayein
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function LeaveList({ leave }: { leave: LeaveEntry[] }) {
  if (leave.length === 0) {
    return (
      <Card className="border-dashed bg-transparent shadow-none">
        <CardContent className="py-8 text-center">
          <CalendarDays
            className="mx-auto size-8 text-muted-foreground"
            aria-hidden
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Abhi koi leave record nahi hai.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {leave.map((item) => (
        <LeaveRow key={item.id} leave={item} />
      ))}
    </div>
  );
}
