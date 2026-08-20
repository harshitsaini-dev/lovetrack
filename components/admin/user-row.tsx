"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, ShieldCheck, ShieldOff } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import { setUserStatus } from "@/lib/admin/actions";
import type { AdminUser } from "@/lib/admin/queries";
import type { AuthFormState } from "@/lib/auth/actions";
import { formatFullDate } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

const TODAY_LABELS: Record<AdminUser["today_status"], string> = {
  not_started: "Shuru nahi kiya",
  checked_in: "Checked in",
  lunch_active: "Lunch par",
  lunch_verified: "Lunch complete",
  checked_out: "Din complete",
};

function initials(user: AdminUser): string {
  const source = user.full_name?.trim() || user.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserRow({ user }: { user: AdminUser }) {
  const [state, submit] = useActionState<AuthFormState, FormData>(
    setUserStatus,
    null,
  );
  useRefreshOnSuccess(state);

  const [confirming, setConfirming] = useState(false);
  const suspended = user.status === "suspended";

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <Avatar className="size-10 shrink-0">
            {user.avatar_url && (
              <AvatarImage src={user.avatar_url} alt="" className="object-cover" />
            )}
            <AvatarFallback className="bg-accent text-xs text-accent-foreground">
              {initials(user)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user.full_name ?? "LoveTrack user"}
              {user.role === "admin" && (
                <span className="ml-2 text-xs font-normal text-primary">
                  admin
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
            <p className="text-xs text-muted-foreground">
              {TODAY_LABELS[user.today_status]} · joined{" "}
              {formatFullDate(user.created_at, user.timezone)}
            </p>
          </div>

          {suspended && (
            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              suspended
            </span>
          )}
        </div>

        {user.flagged_30d > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-status-warn">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            30 din me {user.flagged_30d} submissions flag huin
          </p>
        )}

        <FormMessage state={state} />

        {suspended ? (
          <form action={submit}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="status" value="active" />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="touch-target w-full"
            >
              <ShieldCheck className="size-4" aria-hidden />
              Wapas active karein
            </Button>
          </form>
        ) : confirming ? (
          <form action={submit} className="space-y-2">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="status" value="suspended" />

            <div className="space-y-1.5">
              <Label htmlFor={`reason-${user.id}`} className="text-xs">
                Wajah (audit log me jayegi)
              </Label>
              <Input
                id={`reason-${user.id}`}
                name="reason"
                maxLength={300}
                placeholder="Kyun suspend kar rahe hain"
                className="h-10"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                className="touch-target flex-1"
              >
                Suspend karein
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="touch-target flex-1"
                onClick={() => setConfirming(false)}
              >
                Rehne dein
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("touch-target w-full text-muted-foreground")}
            // An admin cannot be suspended without first losing that role,
            // and the button says so rather than failing on submit.
            disabled={user.role === "admin"}
            onClick={() => setConfirming(true)}
          >
            <ShieldOff className="size-4" aria-hidden />
            {user.role === "admin" ? "Admin suspend nahi hote" : "Suspend karein"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
