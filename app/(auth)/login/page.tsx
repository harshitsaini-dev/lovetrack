import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Wapas aane ka shukriya
        </h1>
        <p className="text-sm text-muted-foreground">
          Apne account me log in karein.
        </p>
      </header>

      {/* useSearchParams needs a Suspense boundary during prerender. */}
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
