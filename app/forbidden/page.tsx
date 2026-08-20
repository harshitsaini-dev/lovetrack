import type { Metadata } from "next";
import { ShieldX } from "lucide-react";

import { StatusScreen } from "@/components/layout/status-screen";

export const metadata: Metadata = { title: "Access nahi hai" };

/**
 * Access denied.
 *
 * Reached when someone is signed in but not allowed here — an ordinary user
 * opening an admin route, say. Deliberately vague about what exists behind
 * the door: confirming that an admin panel is there, and that they are
 * merely not in it, tells them more than they need to know.
 */
export default function ForbiddenPage() {
  return (
    <StatusScreen
      icon={ShieldX}
      tone="warning"
      code="403"
      title="Yahan aapka access nahi hai"
      description="Is page ke liye alag permission chahiye. Agar aapko lagta hai ye galti se hua hai, admin se sampark karein."
      action={{ href: "/app/dashboard", label: "Dashboard par jaayein" }}
    />
  );
}
