import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DayDetail } from "@/components/attendance/day-detail";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import {
  getAdminUser,
  getAdminUserDays,
  getAdminUserEvents,
  getAdminUserLunchProofs,
} from "@/lib/admin/queries";

export const metadata: Metadata = {
  title: "User record",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * One user's full record, for an admin.
 *
 * The review screen only ever showed flagged captures, which is the wrong
 * shape for the question an admin usually has — "what did this person
 * actually do" — and left the honest days invisible. This shows every day,
 * every capture, and the media attached to each, as often as needed.
 *
 * Every photo or clip opened here is written to the audit log against the
 * admin who opened it, and the button says so before it is pressed.
 */
export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();

  const { userId } = await params;
  const user = await getAdminUser(userId);

  if (!user) notFound();

  const [days, events, lunchProofs] = await Promise.all([
    getAdminUserDays(userId),
    getAdminUserEvents(userId),
    getAdminUserLunchProofs(userId),
  ]);

  const name = user.full_name ?? user.email;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Users
      </Link>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <p className="text-xs text-muted-foreground">
          {user.role} · {user.status}
        </p>
      </header>

      <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
        Media kholna audit log me record hota hai — aapke naam ke saath.
      </p>

      {days.length === 0 ? (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Is user ka koi attendance record nahi hai.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {days.map((day) => (
            <DayDetail
              key={day.id}
              day={day}
              events={events
                .filter((e) => e.attendance_id === day.id)
                .map((e) => ({
                  id: e.id,
                  event_type: e.event_type,
                  server_timestamp: e.server_timestamp,
                  place_label: e.place_label,
                  latitude: e.latitude,
                  longitude: e.longitude,
                  accuracy_m: e.accuracy_m,
                  has_photo: e.photo_path !== null,
                  photo_viewable: e.photo_path !== null,
                  status: e.status,
                  risk_score: e.risk_score,
                  device_label: e.device_label,
                }))}
              lunchProof={
                lunchProofs.find((p) => p.attendance_id === day.id) ?? null
              }
              timezone={user.timezone}
              ownerName={name}
              auditNotice
              deletable
            />
          ))}
        </div>
      )}
    </div>
  );
}
