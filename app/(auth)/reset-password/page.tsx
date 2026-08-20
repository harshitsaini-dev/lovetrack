import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Naya password",
};

export default async function ResetPasswordPage() {
  // Reaching this page requires the recovery session created by redeeming
  // a reset code on /verify. Without it there is nothing to reset.
  const user = await getCurrentUser();

  if (!user) {
    redirect("/forgot-password");
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Naya password set karein
        </h1>
        <p className="text-sm text-muted-foreground">
          Ek strong password chunein jo aapne kahin aur use na kiya ho.
        </p>
      </header>

      <ResetPasswordForm />
    </section>
  );
}
