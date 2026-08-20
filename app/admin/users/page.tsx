import type { Metadata } from "next";
import { Search } from "lucide-react";

import { UserRow } from "@/components/admin/user-row";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listUsers } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const users = await listUsers(q);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Suspend karna audit log me jaata hai, wajah ke saath.
        </p>
      </header>

      {/* A plain GET form: the search term stays in the URL, so a filtered
          list can be shared or reloaded without losing it. */}
      <form className="space-y-2">
        <Label htmlFor="q" className="sr-only">
          Naam ya email se dhoondhein
        </Label>
        <div className="relative">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Naam ya email"
            className="h-11 pl-9"
          />
        </div>
      </form>

      {users.length === 0 ? (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {q ? "Koi user nahi mila." : "Abhi koi user nahi hai."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}
