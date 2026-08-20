import type { Metadata } from "next";

import { RetentionPanel } from "@/components/admin/retention-panel";
import { Card, CardContent } from "@/components/ui/card";
import { previewCleanup } from "@/lib/admin/retention";

export const metadata: Metadata = { title: "Storage" };

export default async function AdminStoragePage() {
  const preview = await previewCleanup();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Storage</h1>
        <p className="text-sm text-muted-foreground">
          Purani media hatakar free tier ke andar rahein.
        </p>
      </header>

      {preview ? (
        <RetentionPanel preview={preview} />
      ) : (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Storage ki jaankari abhi nahi mil payi.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
