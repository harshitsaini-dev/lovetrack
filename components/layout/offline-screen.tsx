"use client";

import { useSyncExternalStore } from "react";
import { WifiOff, Wifi } from "lucide-react";

import { StatusScreen } from "@/components/layout/status-screen";
import { Button } from "@/components/ui/button";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Shown when a navigation fails with no network.
 *
 * The connection state is read through useSyncExternalStore rather than an
 * effect, so it hydrates cleanly and updates the moment the browser fires
 * `online` — the user should not have to guess whether it is worth retrying.
 */
export function OfflineScreen() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => false,
  );

  return (
    <StatusScreen
      icon={online ? Wifi : WifiOff}
      tone={online ? "neutral" : "warning"}
      title={online ? "Connection wapas aa gaya" : "Aap offline hain"}
      description={
        online
          ? "Internet chalu ho gaya hai. Ab page reload kar sakte hain."
          : "LoveTrack ko check-in ke liye internet chahiye — photo aur location server par verify hoti hai. Connection wapas aate hi ye screen apne aap badal jayegi."
      }
    >
      <Button
        type="button"
        size="lg"
        variant={online ? "default" : "outline"}
        className="touch-target mt-2 w-full"
        onClick={() => window.location.reload()}
      >
        {online ? "Reload karein" : "Dobara try karein"}
      </Button>
    </StatusScreen>
  );
}
