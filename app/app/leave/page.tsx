import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Leave",
};

export default async function LeavePage() {
  await requireProfile();

  return (
    <ComingSoon
      title="Leave"
      description="Leave apply karein aur uska status dekhein."
      phase="Phase 6"
    />
  );
}
