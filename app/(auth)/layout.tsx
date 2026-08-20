import Link from "next/link";
import { Heart } from "lucide-react";

import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh-safe flex-1 flex-col px-5 pt-safe pb-safe">
      <header className="relative flex justify-center pt-10 pb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight"
        >
          <Heart className="size-5 fill-primary text-primary" aria-hidden />
          Love<span className="-ml-2 text-primary">Track</span>
        </Link>

        <ThemeToggle className="absolute top-2 right-0" />
      </header>

      <main className="mx-auto w-full max-w-sm flex-1">{children}</main>

      <footer className="pt-8 pb-4 text-center text-xs text-muted-foreground">
        Consent-based. Aapka data, aapka control.
      </footer>
    </div>
  );
}
