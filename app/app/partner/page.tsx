import type { Metadata } from "next";
import { HeartHandshake } from "lucide-react";

import { PairRequestForm } from "@/components/partner/pair-request-form";
import { PendingRequests } from "@/components/partner/pending-requests";
import { SharingControls } from "@/components/partner/sharing-controls";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import { getPairsForCurrentUser } from "@/lib/pairing/queries";

export const metadata: Metadata = {
  title: "Partner",
};

export default async function PartnerPage() {
  await requireProfile();

  const { accepted, incoming, outgoing } = await getPairsForCurrentUser();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Partner</h1>
        <p className="text-sm text-muted-foreground">
          Pairing dono ki marzi se hoti hai, aur sharing aap kabhi bhi band kar
          sakte hain.
        </p>
      </header>

      <PendingRequests incoming={incoming} outgoing={outgoing} />

      {accepted.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Aapke partner
          </h2>
          {accepted.map((view) => (
            <SharingControls key={view.pair.id} view={view} />
          ))}
        </section>
      )}

      {accepted.length === 0 && incoming.length === 0 && (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <HeartHandshake
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Abhi koi pairing nahi hai. Neeche se request bhejein.
            </p>
          </CardContent>
        </Card>
      )}

      <PairRequestForm />
    </div>
  );
}
