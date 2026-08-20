import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { listAuditLog } from "@/lib/admin/queries";
import { formatFullDate, formatTime } from "@/lib/format/datetime";

export const metadata: Metadata = { title: "Audit log" };

const ACTION_LABELS: Record<string, string> = {
  user_suspended: "User suspend kiya",
  user_restored: "User wapas active kiya",
  media_viewed: "Evidence dekhi",
  retention_cleanup: "Purani media delete ki",
  settings_changed: "Settings badlin",
};

export default async function AdminAuditPage() {
  const entries = await listAuditLog();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Sirf padha ja sakta hai. Entries un functions se aati hain jo action
          karte hain, isliye jiska log ban raha hai wo ise badal nahi sakta.
        </p>
      </header>

      {entries.length === 0 ? (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Abhi koi entry nahi hai.
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
                    <p className="text-sm font-medium">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </p>
                    <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatTime(entry.created_at)}
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {formatFullDate(entry.created_at)}
                  </p>

                  {entry.detail && (
                    <pre className="overflow-x-auto rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                      {JSON.stringify(entry.detail, null, 2)}
                    </pre>
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
