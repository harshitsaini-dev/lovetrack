"use client";

import { useActionState } from "react";
import Link from "next/link";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, type AuthFormState } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  // The action redirects to the code screen from the server — for every
  // address, registered or not, so this form reveals nothing about who has
  // an account. Only errors come back here.
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    null,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      {!state?.ok && (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="aap@example.com"
              required
              className="h-11"
            />
          </div>

          <SubmitButton pendingLabel="Code bhej rahe hain...">
            Reset code bhejein
          </SubmitButton>
        </>
      )}

      <p className="pt-2 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="rounded font-medium text-primary hover:underline"
        >
          Login par wapas jaayein
        </Link>
      </p>
    </form>
  );
}
