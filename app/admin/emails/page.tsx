import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { listEmailLog } from "@/lib/admin/queries";
import { formatFullDate, formatTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Email log" };

export default async function AdminEmailsPage() {
  const entries = await listEmailLog();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Email log</h1>
        <p className="text-sm text-muted-foreground">
          Failures bhi yahan hain — chupchaap na pahunchi email sabse buri
          hoti hai, kyunki koi dhoondhne nahi jaata.
        </p>
      </header>

      {entries.length === 0 ? (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Abhi koi email nahi bheji gayi.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card>
                <CardContent className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">
                      {entry.subject ?? entry.template}
                    </p>
                    <p
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        entry.status === "sent" && "text-status-active",
                        entry.status === "failed" && "text-destructive",
                        entry.status === "skipped" && "text-muted-foreground",
                      )}
                    >
                      {entry.status}
                    </p>
                  </div>

                  <p className="truncate text-xs text-muted-foreground">
                    {entry.to_email} · {entry.template}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {formatFullDate(entry.created_at)} ·{" "}
                    {formatTime(entry.created_at)}
                  </p>

                  {entry.error && (
                    <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                      {entry.error}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
