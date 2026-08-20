import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = { href: string; label: string };

/**
 * Shared shell for the pages that tell someone something went wrong.
 *
 * Kept deliberately plain: no map, no data fetching, nothing that could
 * itself fail. A 500 page that throws is worse than no 500 page.
 */
export function StatusScreen({
  icon: Icon,
  tone = "neutral",
  code,
  title,
  description,
  action,
  secondary,
  children,
}: {
  icon: LucideIcon;
  tone?: "neutral" | "warning" | "danger";
  code?: string;
  title: string;
  description: string;
  action?: Action;
  secondary?: Action;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center pt-safe pb-safe">
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl",
          tone === "danger" && "bg-destructive/10 text-destructive",
          tone === "warning" && "bg-status-warn/10 text-status-warn",
          tone === "neutral" && "bg-accent text-accent-foreground",
        )}
      >
        <Icon className="size-7" aria-hidden />
      </span>

      {code && (
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {code}
        </p>
      )}

      <h1 className="text-xl font-semibold tracking-tight text-balance">
        {title}
      </h1>

      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {children}

      <div className="flex w-full flex-col gap-2 pt-2">
        {action && (
          <Button asChild size="lg" className="touch-target w-full">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
        {secondary && (
          <Button
            asChild
            size="lg"
            variant="outline"
            className="touch-target w-full"
          >
            <Link href={secondary.href}>{secondary.label}</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
