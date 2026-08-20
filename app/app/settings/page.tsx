import type { Metadata } from "next";

import { InstallButton } from "@/components/layout/install-button";
import { AvatarPicker } from "@/components/settings/avatar-picker";
import { PasswordForm } from "@/components/settings/password-form";
import { SettingsForm } from "@/components/settings/settings-form";
import { requireProfile } from "@/lib/auth/session";
import { getPairsForCurrentUser } from "@/lib/pairing/queries";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const profile = await requireProfile();

  // If a partner set the reminder times, the screen has to say who. A
  // schedule that changed with no explanation reads as a bug in the phone,
  // and the person has no way to find out otherwise.
  const { accepted } = await getPairsForCurrentUser();
  const setter = profile.reminder_set_by
    ? (accepted.find((v) => v.partner.id === profile.reminder_set_by)?.partner
        .full_name ?? "Aapke partner")
    : null;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Profile, reminder aur notification preferences.
        </p>
      </header>

      <AvatarPicker profile={profile} />

      <SettingsForm profile={profile} partnerSetReminders={setter} />

      <PasswordForm />

      <div className="border-t pt-5">
        <InstallButton className="w-full" hideWhenUnavailable />
      </div>
    </div>
  );
}
