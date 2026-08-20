import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "History",
};

export default async function HistoryPage() {
  await requireProfile();

  return (
    <ComingSoon
      title="History"
      description="Aapki attendance ka poora record."
      phase="Phase 4"
    />
  );
}
