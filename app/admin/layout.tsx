import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The gate. RLS enforces the same rule at the database level, so a
  // missed check here would not expose data — but it would show someone a
  // page full of empty tables, which is its own kind of wrong.
  await requireAdmin();

  return (
    <div className="flex min-h-dvh-safe flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 pt-safe backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-3 px-4 lg:max-w-4xl">
          <Link
            href="/app/dashboard"
            className="flex touch-target items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label="App par wapas jaayein"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>

          <span className="inline-flex items-center gap-1.5 font-semibold tracking-tight">
            <Shield className="size-4 text-primary" aria-hidden />
            Admin
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5 lg:max-w-4xl">
        {children}
      </main>
    </div>
  );
}
