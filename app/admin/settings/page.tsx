import type { Metadata } from "next";

import { RiskSettingsForm } from "@/components/admin/risk-settings-form";
import { Card, CardContent } from "@/components/ui/card";
import { getSettings } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Risk settings" };

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Risk settings</h1>
        <p className="text-sm text-muted-foreground">
          Har change audit log me record hota hai, purani aur nayi value ke
          saath.
        </p>
      </header>

      {settings ? (
        <RiskSettingsForm settings={settings} />
      ) : (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Settings load nahi ho payin.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
