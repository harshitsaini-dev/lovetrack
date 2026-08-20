"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LogOut, Shield, User } from "lucide-react";

import { isActivePath, NAV_ITEMS } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth/actions";
import type { Profile } from "@/types/database";

function initials(profile: Profile): string {
  const source = profile.full_name?.trim() || profile.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppHeader({ profile }: { profile: Profile }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 pt-safe backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between gap-2 px-4 lg:max-w-5xl">
        <Link
          href="/app/dashboard"
          className="inline-flex items-center gap-1.5 rounded-md font-semibold tracking-tight"
        >
          <Heart className="size-4 fill-primary text-primary" aria-hidden />
          LoveTrack
        </Link>

        {/* Desktop navigation. Below lg the bottom bar handles this. */}
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);

              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="touch-target"
                aria-label="Account menu"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                    {initials(profile)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">
                  {profile.full_name ?? "LoveTrack user"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile.email}
                </p>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href="/app/settings">
                  <User className="size-4" aria-hidden />
                  Profile &amp; settings
                </Link>
              </DropdownMenuItem>

              {profile.role === "admin" && (
                <DropdownMenuItem asChild>
                  <Link href="/admin/dashboard">
                    <Shield className="size-4" aria-hidden />
                    Admin panel
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild variant="destructive">
                <form action={logout}>
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut className="size-4" aria-hidden />
                    Log out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
