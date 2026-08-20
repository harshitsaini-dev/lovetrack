"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { AuthFormState } from "@/lib/auth/actions";
import { changePassword } from "@/lib/profile/actions";

export function PasswordForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    changePassword,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle
          role="heading"
          aria-level={2}
          className="flex items-center gap-2 text-base"
        >
          <KeyRound className="size-4 text-primary" aria-hidden />
          Password badlein
        </CardTitle>
        <CardDescription>
          Current password poochha jaata hai — taaki koi khuli hui session ka
          fayda uthakar aapko aapke hi account se baahar na kar de.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/*
          key resets the fields after a successful change, so the old values
          are not left sitting in the form.
        */}
        <form
          key={state?.ok ? "done" : "editing"}
          action={formAction}
          className="space-y-4"
          noValidate
        >
          <FormMessage state={state} />

          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <PasswordInput
              id="currentPassword"
              name="currentPassword"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Naya password</Label>
            <PasswordInput
              id="newPassword"
              name="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
              aria-describedby="new-password-hint"
            />
            <p id="new-password-hint" className="text-xs text-muted-foreground">
              Kam se kam 8 characters, ek uppercase, ek lowercase aur ek number.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">Naya password dobara</Label>
            <PasswordInput
              id="confirmNewPassword"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </div>

          <SubmitButton pendingLabel="Badal raha hai...">
            Password update karein
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
