"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Light/dark switch.
 *
 * The icon is swapped with CSS rather than React state, so it is already
 * correct on the first paint — no hydration mismatch and no flash of the
 * wrong icon while the theme is being resolved.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("touch-target", className)}
      aria-label="Theme badlein"
      onClick={() =>
        setTheme(
          document.documentElement.classList.contains("dark")
            ? "light"
            : "dark",
        )
      }
    >
      <Moon className="size-4 dark:hidden" aria-hidden />
      <Sun className="hidden size-4 dark:block" aria-hidden />
    </Button>
  );
}
