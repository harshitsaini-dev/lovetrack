"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ServerCrash } from "lucide-react";

import { StatusScreen } from "@/components/layout/status-screen";
import { Button } from "@/components/ui/button";

/**
 * Server error boundary.
 *
 * The `digest` is shown deliberately: it is the only handle the user has
 * when reporting a problem, and it maps to the server log entry. The error
 * message itself is never rendered — it can carry internals we have no
 * business putting on someone's screen.
 */
export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error", error);
  }, [error]);

  return (
    <StatusScreen
      icon={ServerCrash}
      tone="danger"
      code="500"
      title="Kuch galat ho gaya"
      description="Ye humari taraf se problem hai, aapki nahi. Dobara try karein — aksar ek baar me theek ho jaata hai."
    >
      {error.digest && (
        <p className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}

      <div className="flex w-full flex-col gap-2 pt-2">
        <Button
          type="button"
          size="lg"
          className="touch-target w-full"
          onClick={reset}
        >
          Dobara try karein
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="touch-target w-full"
        >
          <Link href="/app/dashboard">Dashboard par jaayein</Link>
        </Button>
      </div>
    </StatusScreen>
  );
}
