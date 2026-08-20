import Link from "next/link";
import { Camera, Clock, MapPin, ShieldCheck, Utensils } from "lucide-react";

import { InstallButton } from "@/components/layout/install-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Clock,
    title: "Their working day",
    body: "See when a friend reached work and when they left, with the time the server recorded — not the one their phone claims.",
  },
  {
    icon: Utensils,
    title: "Lunch, start to finish",
    body: "Lunch in and lunch out are separate, so you can see how long the break actually was — with a short clip recorded during it.",
  },
  {
    icon: Camera,
    title: "Live camera proof",
    body: "Check-in and check-out need a photo taken right then. There is no gallery upload, because a stored photo proves nothing about now.",
  },
  {
    icon: MapPin,
    title: "Where, not where now",
    body: "Each entry carries the place it was made from — tap to open it in Maps. Nothing is tracked between entries.",
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
          <ShieldCheck className="size-3.5" aria-hidden />
          Both sides agree. Nothing is hidden.
        </span>

        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Love<span className="text-primary">Track</span>
        </h1>

        <p className="text-pretty text-base leading-relaxed text-muted-foreground">
          Know when your friends start work, break for lunch, and head home.
          They mark each one themselves, with a live photo and the location it
          was made from — so what you see actually happened.
        </p>

        {/*
          Said on the way in, not buried in a policy page. Anyone reading this
          is about to be on both ends of it, and the second sentence is the
          one that makes the first acceptable.
        */}
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          This is not a tracker. Nobody appears here until you have both agreed
          to pair, nothing is recorded unless they mark it, and either of you
          can stop sharing at any moment.
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

      <section className="mt-12 grid gap-3 sm:mt-16 sm:grid-cols-2">
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
          LoveTrack does not claim to be spoof-proof. It makes a faked entry
          hard to produce and easy to spot, which is a different and more
          honest promise.
        </p>
      </footer>
    </main>
  );
}
