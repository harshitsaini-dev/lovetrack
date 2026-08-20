"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { FormMessage } from "@/components/auth/form-message";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { Label } from "@/components/ui/label";
import { resetPassword, type AuthFormState } from "@/lib/auth/actions";

export function ResetPasswordForm() {
  const router = useRouter();
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    resetPassword,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      const timer = setTimeout(() => router.replace("/app/dashboard"), 1200);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      {!state?.ok && (
        <>
          <div className="space-y-2">
            <Label htmlFor="password">Naya password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="text-xs text-muted-foreground">
              Kam se kam 8 characters, ek uppercase, ek lowercase aur ek number.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Password dobara</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </div>

          <SubmitButton pendingLabel="Update ho raha hai...">
            Password update karein
          </SubmitButton>
        </>
      )}
    </form>
  );
}
