"use client";

import { useActionState } from "react";
import { Check, Clock, X } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { PartnerIdentity } from "@/components/partner/partner-identity";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import type { AuthFormState } from "@/lib/auth/actions";
import {
  acceptPairing,
  rejectPairing,
  revokePairing,
} from "@/lib/pairing/actions";
import type { PairView } from "@/lib/pairing/queries";

function IncomingRequest({ view }: { view: PairView }) {
  const [acceptState, accept] = useActionState<AuthFormState, FormData>(
    acceptPairing,
    null,
  );
  const [rejectState, reject] = useActionState<AuthFormState, FormData>(
    rejectPairing,
    null,
  );
  useRefreshOnSuccess(acceptState ?? rejectState);

  return (
    <Card>
      <CardContent className="space-y-3">
        <PartnerIdentity partner={view.partner} />

        <p className="text-sm text-muted-foreground">
          Inhone aapko pair karne ki request bheji hai.
        </p>

        <FormMessage state={acceptState ?? rejectState} />

        <div className="flex gap-2">
          <form action={accept} className="flex-1">
            <input type="hidden" name="pairId" value={view.pair.id} />
            <Button type="submit" className="touch-target w-full">
              <Check className="size-4" aria-hidden />
              Accept
            </Button>
          </form>

          <form action={reject} className="flex-1">
            <input type="hidden" name="pairId" value={view.pair.id} />
            <Button
              type="submit"
              variant="outline"
              className="touch-target w-full"
            >
              <X className="size-4" aria-hidden />
              Decline
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function OutgoingRequest({ view }: { view: PairView }) {
  const [state, withdraw] = useActionState<AuthFormState, FormData>(
    revokePairing,
    null,
  );
  useRefreshOnSuccess(state);

  return (
    <Card>
      <CardContent className="space-y-3">
        <PartnerIdentity partner={view.partner} />

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          Inke accept karne ka intezaar hai.
        </p>

        <FormMessage state={state} />

        <form action={withdraw}>
          <input type="hidden" name="pairId" value={view.pair.id} />
          <Button
            type="submit"
            variant="outline"
            className="touch-target w-full"
          >
            Request wapas lein
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function PendingRequests({
  incoming,
  outgoing,
}: {
  incoming: PairView[];
  outgoing: PairView[];
}) {
  if (!incoming.length && !outgoing.length) return null;

  return (
    <section className="space-y-3">
      {incoming.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-muted-foreground">
            Aayi hui requests
          </h2>
          {incoming.map((view) => (
            <IncomingRequest key={view.pair.id} view={view} />
          ))}
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <h2 className="pt-1 text-sm font-medium text-muted-foreground">
            Bheji hui requests
          </h2>
          {outgoing.map((view) => (
            <OutgoingRequest key={view.pair.id} view={view} />
          ))}
        </>
      )}
    </section>
  );
}
