import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { FlaggedEventCard } from "@/components/admin/flagged-event";
import { Card, CardContent } from "@/components/ui/card";
import { listFlaggedEvents } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Review" };

export default async function AdminReviewPage() {
  const events = await listFlaggedEvents();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
        <p className="text-sm text-muted-foreground">
          Flag aur reject hui submissions, unke signals ke saath. Ek flag ka
          matlab dhokha nahi hai — sirf ye ki kuch dekhne layak hai.
        </p>
      </header>

      {events.length === 0 ? (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <ShieldCheck
              className="mx-auto size-8 text-status-active"
              aria-hidden
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Kuch review karne ko nahi hai.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <FlaggedEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
