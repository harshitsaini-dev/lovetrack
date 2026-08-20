import type { Metadata } from "next";
import { Camera, CircleDot, Clock, Utensils } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard",
};

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const profile = await requireProfile();

  // Rendered on the server, in the user's own timezone — the client clock
  // is never authoritative anywhere in LoveTrack.
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: profile.timezone,
    }).format(now),
  );
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: profile.timezone,
  }).format(now);

  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{today}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting(hour)}, {firstName}
        </h1>
      </header>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CircleDot className="size-4 text-status-off" aria-hidden />
            Aaj abhi tak koi activity nahi
          </div>

          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <Camera className="size-4 shrink-0" aria-hidden />
              Check-in pending
            </li>
            <li className="flex items-center gap-2.5">
              <Utensils className="size-4 shrink-0" aria-hidden />
              Lunch pending
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="size-4 shrink-0" aria-hidden />
              Check-out pending
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-dashed bg-transparent shadow-none">
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Check-in, lunch proof aur partner activity Phase 4 aur 5 me aayenge.
            Abhi auth, profile aur security foundation ready hai.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
