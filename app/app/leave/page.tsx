import type { Metadata } from "next";

import { LeaveForm } from "@/components/leave/leave-form";
import { LeaveList } from "@/components/leave/leave-list";
import { requireProfile } from "@/lib/auth/session";
import { getTodayInTimezone } from "@/lib/format/datetime";
import { getMyLeave } from "@/lib/leave/queries";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage() {
  const profile = await requireProfile();

  const leave = await getMyLeave();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Leave</h1>
        <p className="text-sm text-muted-foreground">
          Chhutti mark karein — us din ka reminder nahi aayega.
        </p>
      </header>

      <LeaveForm today={getTodayInTimezone(profile.timezone)} />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Aapki leave
        </h2>
        <LeaveList leave={leave} />
      </section>
    </div>
  );
}
