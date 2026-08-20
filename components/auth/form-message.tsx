"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AuthFormState } from "@/lib/auth/actions";

/**
 * Renders the result of an auth action. Uses role="alert" + aria-live so
 * screen readers announce errors without the user hunting for them.
 */
export function FormMessage({ state }: { state: AuthFormState }) {
  if (!state) return null;
  if (state.ok && !state.message) return null;

  const isError = !state.ok;

  return (
    <Alert
      role="alert"
      aria-live="polite"
      // Next.js ships its own role="alert" route announcer, so tests need a
      // stable hook to target this one specifically.
      data-testid="form-message"
      variant={isError ? "destructive" : "default"}
    >
      {isError ? (
        <AlertCircle className="size-4" aria-hidden />
      ) : (
        <CheckCircle2 className="size-4" aria-hidden />
      )}
      <AlertDescription>
        {isError ? state.error : state.message}
      </AlertDescription>
    </Alert>
  );
}
