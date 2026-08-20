import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Partner",
};

export default async function PartnerPage() {
  await requireProfile();

  return (
    <ComingSoon
      title="Partner"
      description="Pairing, permissions aur partner ki activity — sab aapki marzi se."
      phase="Phase 3"
    />
  );
}
