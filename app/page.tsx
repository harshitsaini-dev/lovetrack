import Link from "next/link";
import { Camera, Heart, MapPin, ShieldCheck } from "lucide-react";

import { InstallButton } from "@/components/layout/install-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Camera,
    title: "Live camera proof",
    body: "Attendance sirf live camera se — gallery upload ka option hi nahi hai.",
  },
  {
    icon: MapPin,
    title: "Location kahin se bhi",
    body: "Koi fixed jagah ki paabandi nahi. Bas location genuine aur accurate honi chahiye.",
  },
  {
    icon: ShieldCheck,
    title: "Consent-first",
    body: "Sharing sirf pairing ke baad, aur 'Stop Sharing' hamesha ek tap door.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-safe pb-safe sm:max-w-2xl">
      <div className="flex justify-end pt-3">
        <ThemeToggle />
      </div>

      <section className="flex flex-col items-center gap-4 pt-8 text-center sm:pt-12">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Heart className="size-3.5" aria-hidden />
          Consent-based, never hidden
        </span>

        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Love<span className="text-primary">Track</span>
        </h1>

        <p className="text-pretty text-base leading-relaxed text-muted-foreground">
          Couples aur friends ke liye attendance &amp; activity verification —
          live camera proof, sahi location, aur poora control aapke haath me.
        </p>

        <div className="mt-2 flex w-full flex-col gap-3 sm:max-w-xs">
          <Button asChild size="lg" className="touch-target w-full">
            <Link href="/register">Get started</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="touch-target w-full"
          >
            <Link href="/login">I already have an account</Link>
          </Button>

          <InstallButton className="w-full" />
        </div>
      </section>

      <section className="mt-12 grid gap-3 sm:mt-16 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <article
            key={title}
            className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
          >
            <Icon className="size-5 text-primary" aria-hidden />
            <h2 className="mt-3 text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </article>
        ))}
      </section>

      <footer className="mt-auto pt-12 pb-6 text-center text-xs text-muted-foreground">
        <p className="text-pretty">
          LoveTrack spoof-proof hone ka daava nahi karta. Ye multi-signal
          verification se fraud ko mushkil aur detectable banata hai.
        </p>
      </footer>
    </main>
  );
}
