import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  HardDrive,
  Mail,
  ScrollText,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getAdminStats } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

const SECTIONS = [
  {
    href: "/admin/users",
    icon: Users,
    title: "Users",
    description: "Accounts dekhein, suspend ya restore karein",
  },
  {
    href: "/admin/review",
    icon: AlertTriangle,
    title: "Review",
    description: "Flag hui submissions aur unke signals",
  },
  {
    href: "/admin/storage",
    icon: HardDrive,
    title: "Storage",
    description: "Purani media hatayein, retention set karein",
  },
  {
    href: "/admin/settings",
    icon: SlidersHorizontal,
    title: "Risk settings",
    description: "Accuracy limits aur score thresholds",
  },
  {
    href: "/admin/emails",
    icon: Mail,
    title: "Email log",
    description: "Kya bheja gaya, kya fail hua",
  },
  {
    href: "/admin/audit",
    icon: ScrollText,
    title: "Audit log",
    description: "Har sensitive admin action ka record",
  },
];

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "muted";
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "warn" && value > 0 && "text-status-warn",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default async function AdminHomePage() {
  const stats = await getAdminStats();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Har sensitive action audit log me jaata hai — media dekhna bhi.
        </p>
      </header>

      {stats && (
        <>
          <section className="grid grid-cols-3 gap-2">
            <Stat label="Users" value={stats.users} />
            <Stat label="Aaj checked in" value={stats.checked_in_today} />
            <Stat label="Aaj complete" value={stats.completed_today} />
            <Stat label="Aaj chhutti" value={stats.on_leave_today} tone="muted" />
            <Stat label="Pairs" value={stats.pairs} tone="muted" />
            <Stat label="Suspended" value={stats.suspended} tone="warn" />
          </section>

          {(stats.needs_review > 0 || stats.emails_failed_7d > 0) && (
            <Card>
              <CardContent className="space-y-2">
                {stats.needs_review > 0 && (
                  <Link
                    href="/admin/review"
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <AlertTriangle
                      className="size-4 shrink-0 text-status-warn"
                      aria-hidden
                    />
                    <span className="flex-1">
                      {stats.needs_review} submissions review ke liye
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                )}

                {stats.emails_failed_7d > 0 && (
                  <Link
                    href="/admin/emails"
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <Mail
                      className="size-4 shrink-0 text-destructive"
                      aria-hidden
                    />
                    <span className="flex-1">
                      {stats.emails_failed_7d} emails 7 din me fail huin
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ul className="space-y-3">
        {SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <li key={href}>
            <Link href={href} className="block rounded-xl">
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="flex items-center gap-3">
                  <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {description}
                    </p>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
