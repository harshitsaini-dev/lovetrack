"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resendCode,
  verifyCode,
  type AuthFormState,
} from "@/lib/auth/actions";

type Props = {
  email: string;
  mode: "signup" | "recovery";
};

export function VerifyForm({ email, mode }: Props) {
  // A correct code redirects from the server, so only failures land here.
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    verifyCode,
    null,
  );
  const [resendState, resendAction] = useActionState<AuthFormState, FormData>(
    resendCode,
    null,
  );

  // A fresh code makes the previous error meaningless — clearing it stops
  // "code galat hai" sitting above a code that has not been tried yet.
  const [dismissed, setDismissed] = useState(false);

  return (
    <div className="space-y-4">
      {!dismissed && <FormMessage state={state} />}
      <FormMessage state={resendState} />

      <form
        action={formAction}
        className="space-y-4"
        noValidate
        onSubmit={() => setDismissed(false)}
      >
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="mode" value={mode} />

        <div className="space-y-2">
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            name="code"
            type="text"
            // numeric keypad on a phone, without the spinner arrows and
            // scroll-to-change behaviour of type="number"
            inputMode="numeric"
            autoComplete="one-time-code"
            // Lets Android and iOS offer the code straight from the
            // notification, so most people never open their inbox.
            pattern="[0-9]*"
            maxLength={10}
            placeholder="12345678"
            required
            autoFocus
            className="h-12 text-center font-mono text-xl tracking-[0.4em]"
          />
          <p className="text-xs text-muted-foreground">
            Code <span className="font-medium text-foreground">{email}</span> par
            bheja hai.
          </p>
        </div>

        <SubmitButton pendingLabel="Verify ho raha hai...">Verify karein</SubmitButton>
      </form>

      <form action={resendAction} onSubmit={() => setDismissed(true)}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="mode" value={mode} />
        <button
          type="submit"
          className="w-full rounded py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Code nahi mila? Naya bhejein
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="rounded font-medium text-primary hover:underline"
        >
          Login par wapas jaayein
        </Link>
      </p>
    </div>
  );
}
