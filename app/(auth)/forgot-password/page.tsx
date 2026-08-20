import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Password reset",
};

export default function ForgotPasswordPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Password bhool gaye?
        </h1>
        <p className="text-sm text-muted-foreground">
          Email daalein, hum reset link bhej denge.
        </p>
      </header>

      <ForgotPasswordForm />
    </section>
  );
}
