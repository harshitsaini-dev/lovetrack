import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function RegisterPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Apna account banayein
        </h1>
        <p className="text-sm text-muted-foreground">
          Sharing hamesha aapki marzi se — koi hidden tracking nahi.
        </p>
      </header>

      <RegisterForm />
    </section>
  );
}
