"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";

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
import { sendPairingRequest } from "@/lib/pairing/actions";

export function PairRequestForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    sendPairingRequest,
    null,
  );
  useRefreshOnSuccess(state);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="size-4 text-primary" aria-hidden />
          Kisi ko pair karein
        </CardTitle>
        <CardDescription>
          Request bhejein. Jab tak wo accept na karein, kuch bhi share nahi
          hota.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4" noValidate>
          <FormMessage state={state} />

          <div className="space-y-2">
            <Label htmlFor="pair-email">Unka email</Label>
            <Input
              id="pair-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="partner@example.com"
              required
              className="h-11"
            />
          </div>

          <SubmitButton pendingLabel="Bhej rahe hain...">
            Request bhejein
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
