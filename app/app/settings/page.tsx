import type { Metadata } from "next";

import { InstallButton } from "@/components/layout/install-button";
import { AvatarPicker } from "@/components/settings/avatar-picker";
import { PasswordForm } from "@/components/settings/password-form";
import { SettingsForm } from "@/components/settings/settings-form";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const profile = await requireProfile();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Profile, reminder aur notification preferences.
        </p>
      </header>

      <AvatarPicker profile={profile} />

      <SettingsForm profile={profile} />

      <PasswordForm />

      <div className="border-t pt-5">
        <InstallButton className="w-full" hideWhenUnavailable />
      </div>
    </div>
  );
}
