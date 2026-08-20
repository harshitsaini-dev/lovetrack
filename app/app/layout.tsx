import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { requireProfile } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Middleware already blocks anonymous users; this is the second gate and
  // also gives every child access to the loaded profile.
  const profile = await requireProfile();

  return (
    <div className="flex min-h-dvh-safe flex-1 flex-col">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5 lg:max-w-5xl">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
