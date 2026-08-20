"use client";

import {
  useActionState,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldOff, Unlink } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { PartnerIdentity } from "@/components/partner/partner-identity";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import type { AuthFormState } from "@/lib/auth/actions";
import {
  revokePairing,
  setSharePermission,
  stopAllSharing,
} from "@/lib/pairing/actions";
import type { PairView } from "@/lib/pairing/queries";
import type { PairPermissions } from "@/types/database";

const CONTROLS = [
  {
    key: "share_attendance",
    label: "Attendance",
    hint: "Check-in, lunch aur check-out ka time.",
  },
  {
    key: "share_location",
    label: "Location",
    hint: "Har event ke waqt ki jagah. Live tracking nahi — sirf us moment ki location.",
  },
  {
    key: "share_lunch_proof",
    label: "Lunch proof video",
    hint: "Aapki lunch verification video.",
  },
  {
    key: "share_leave",
    label: "Leave",
    hint: "Aapki leave requests aur unka status.",
  },
] as const satisfies ReadonlyArray<{
  key: keyof PairPermissions;
  label: string;
  hint: string;
}>;

function PermissionSwitch({
  pairId,
  permissionKey,
  label,
  hint,
  initial,
}: {
  pairId: string;
  permissionKey: string;
  label: string;
  hint: string;
  initial: boolean;
}) {
  const router = useRouter();

  // useOptimistic, not useState: the switch must follow the server value
  // whenever it changes underneath us — "stop all sharing" flips all four
  // at once, and plain local state would keep showing them ON. On a privacy
  // control, a switch that lies about its state is the worst kind of bug.
  const [checked, setChecked] = useOptimistic(initial);
  const [pending, startTransition] = useTransition();

  const id = `${pairId}-${permissionKey}`;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p
          id={`${id}-hint`}
          className="mt-0.5 text-xs leading-relaxed text-muted-foreground"
        >
          {hint}
        </p>
      </div>

      <Switch
        id={id}
        checked={checked}
        disabled={pending}
        aria-describedby={`${id}-hint`}
        onCheckedChange={(next) => {
          startTransition(async () => {
            setChecked(next);

            const data = new FormData();
            data.set("pairId", pairId);
            data.set("permission", permissionKey);
            data.set("enabled", String(next));

            await setSharePermission(null, data);

            // Pull the saved value back. If the write failed, the optimistic
            // value is discarded and the switch snaps to the truth rather
            // than claiming a change that never happened.
            router.refresh();
          });
        }}
      />
    </div>
  );
}

/** What the partner has chosen to share back — read-only from this side. */
function TheirSharing({ theirs }: { theirs: PairPermissions | null }) {
  const shared = CONTROLS.filter((c) => theirs?.[c.key] === true);

  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-xs font-medium">Wo aapke saath kya share karte hain</p>

      {shared.length === 0 ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <EyeOff className="size-3.5 shrink-0" aria-hidden />
          Abhi kuch nahi. Ye unka faisla hai — aap badal nahi sakte.
        </p>
      ) : (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="size-3.5 shrink-0" aria-hidden />
          {shared.map((c) => c.label).join(", ")}
        </p>
      )}
    </div>
  );
}

export function SharingControls({ view }: { view: PairView }) {
  const [stopState, stopAll] = useActionState<AuthFormState, FormData>(
    stopAllSharing,
    null,
  );
  const [revokeState, revoke] = useActionState<AuthFormState, FormData>(
    revokePairing,
    null,
  );
  const [confirmingUnpair, setConfirmingUnpair] = useState(false);

  useRefreshOnSuccess(stopState ?? revokeState);

  const mine = view.mine;
  const anyShared = CONTROLS.some((c) => mine?.[c.key] === true);

  return (
    <Card>
      <CardHeader>
        <PartnerIdentity partner={view.partner} />
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-1">
          <CardTitle className="text-sm">Aap kya share karte hain</CardTitle>
          <CardDescription className="text-xs">
            Har switch sirf aapke data ke liye hai. Aapka partner ise badal
            nahi sakta.
          </CardDescription>
        </div>

        <div className="space-y-4">
          {CONTROLS.map(({ key, label, hint }) => (
            <PermissionSwitch
              key={key}
              pairId={view.pair.id}
              permissionKey={key}
              label={label}
              hint={hint}
              initial={mine?.[key] === true}
            />
          ))}
        </div>

        <FormMessage state={stopState} />

        {/*
          Always present, never buried behind a menu. Being able to stop
          instantly is the difference between a consent tool and a
          surveillance one.
        */}
        <form action={stopAll}>
          <input type="hidden" name="pairId" value={view.pair.id} />
          <Button
            type="submit"
            variant="outline"
            disabled={!anyShared}
            className="touch-target w-full"
          >
            <ShieldOff className="size-4" aria-hidden />
            {anyShared ? "Sab sharing band karein" : "Kuch share nahi ho raha"}
          </Button>
        </form>

        <Separator />

        <TheirSharing theirs={view.theirs} />

        <Separator />

        <FormMessage state={revokeState} />

        {confirmingUnpair ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Pairing hatane par dono taraf ki sharing turant band ho jayegi.
              Pakka?
            </p>
            <div className="flex gap-2">
              <form action={revoke} className="flex-1">
                <input type="hidden" name="pairId" value={view.pair.id} />
                <Button
                  type="submit"
                  variant="destructive"
                  className="touch-target w-full"
                >
                  Haan, unpair karein
                </Button>
              </form>
              <Button
                type="button"
                variant="ghost"
                className="touch-target flex-1"
                onClick={() => setConfirmingUnpair(false)}
              >
                Rehne dein
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="touch-target w-full text-muted-foreground"
            onClick={() => setConfirmingUnpair(true)}
          >
            <Unlink className="size-4" aria-hidden />
            Pairing hatayein
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
