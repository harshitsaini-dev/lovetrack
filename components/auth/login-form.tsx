"use client";

import { useActionState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { FormMessage } from "@/components/auth/form-message";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type AuthFormState } from "@/lib/auth/actions";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    login,
    null,
  );

  // The link-error case (expired confirm link) arrives as a query param.
  const linkError = searchParams.get("error");
  const next = searchParams.get("next") ?? "/app/dashboard";

  useEffect(() => {
    if (state?.ok) {
      router.replace(next);
    }
  }, [state, router, next]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {linkError && !state && (
        <FormMessage state={{ ok: false, error: linkError }} />
      )}
      <FormMessage state={state} />

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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="rounded text-xs font-medium text-primary hover:underline"
          >
            Bhool gaye?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>

      <div className="flex items-center gap-2.5 pt-1">
        {/*
          Ticked by default, because that is what most people want on their
          own phone. Unticking makes the auth cookie a session cookie, which
          the browser drops on close — the point of the control on a shared
          or borrowed device.
        */}
        <Checkbox id="remember" name="remember" defaultChecked />
        <Label htmlFor="remember" className="text-sm font-normal">
          Mujhe yaad rakhein
        </Label>
      </div>

      <SubmitButton pendingLabel="Login ho raha hai...">Log in</SubmitButton>

      <p className="pt-2 text-center text-sm text-muted-foreground">
        Account nahi hai?{" "}
        <Link
          href="/register"
          className="rounded font-medium text-primary hover:underline"
        >
          Sign up karein
        </Link>
      </p>
    </form>
  );
}
