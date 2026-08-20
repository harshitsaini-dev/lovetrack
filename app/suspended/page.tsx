import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Account suspended",
};

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center pt-safe pb-safe">
      <ShieldAlert className="size-10 text-destructive" aria-hidden />

      <h1 className="text-xl font-semibold tracking-tight">
        Aapka account suspend hai
      </h1>

      <p className="text-sm leading-relaxed text-muted-foreground">
        Is account se abhi LoveTrack use nahi kiya ja sakta. Agar aapko lagta
        hai ki ye galti se hua hai, admin se sampark karein.
      </p>

      <form action={logout}>
        <Button type="submit" variant="outline" className="touch-target">
          Log out
        </Button>
      </form>
    </main>
  );
}
