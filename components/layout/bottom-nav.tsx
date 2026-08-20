"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActivePath, NAV_ITEMS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/**
 * Primary navigation on phones — fixed to the bottom so it stays within
 * thumb reach. Hidden from lg upwards, where the header nav takes over.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex touch-target flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("size-5", active && "fill-primary/15")}
                  aria-hidden
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
