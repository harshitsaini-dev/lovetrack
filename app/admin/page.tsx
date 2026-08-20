import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, HardDrive } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin" };

const SECTIONS = [
  {
    href: "/admin/storage",
    icon: HardDrive,
    title: "Storage",
    description: "Purani media hatayein, retention set karein",
  },
];

export default function AdminHomePage() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Sirf admins ke liye. Har sensitive action audit log me jaata hai.
        </p>
      </header>

      <ul className="space-y-3">
        {SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <li key={href}>
            <Link href={href} className="block rounded-xl">
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="flex items-center gap-3">
                  <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
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
