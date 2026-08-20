import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VerifyForm } from "@/components/auth/verify-form";

export const metadata: Metadata = {
  title: "Verify",
  // Carries an email address in the query string.
  robots: { index: false, follow: false, nocache: true },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; mode?: string }>;
}) {
  const { email, mode } = await searchParams;

  // Without an address there is nothing to verify against, and guessing one
  // would be worse than sending them back to start again.
  if (!email) redirect("/login");

  const isRecovery = mode === "recovery";

  return (
    <section className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isRecovery ? "Reset code daalein" : "Email verify karein"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isRecovery
            ? "Code confirm hote hi naya password set kar sakte hain."
            : "Email par bheja gaya code daalein — bas ek step aur."}
        </p>
      </header>

      <VerifyForm email={email} mode={isRecovery ? "recovery" : "signup"} />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Email nahi mila? Spam folder check karein. Code 1 ghante me expire ho
        jaata hai.
      </p>
    </section>
  );
}
