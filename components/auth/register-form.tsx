"use client";

import { useActionState } from "react";
import Link from "next/link";

import { FormMessage } from "@/components/auth/form-message";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register, type AuthFormState } from "@/lib/auth/actions";

export function RegisterForm() {
  // On success the action redirects to /verify from the server, so there is
  // no success state to render here — only errors ever come back.
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    register,
    null,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <div className="space-y-2">
        <Label htmlFor="fullName">Poora naam</Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Harshit Saini"
          required
          className="h-11"
        />
      </div>

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

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
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

      <SubmitButton pendingLabel="Account ban raha hai...">
        Create account
      </SubmitButton>

      <p className="pt-2 text-center text-sm text-muted-foreground">
        Pehle se account hai?{" "}
        <Link
          href="/login"
          className="rounded font-medium text-primary hover:underline"
        >
          Log in karein
        </Link>
      </p>
    </form>
  );
}
