"use client";

import { useState } from "react";
import { Check, Download, Share } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { cn } from "@/lib/utils";

type InstallButtonProps = {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  /** Render nothing when installation is unavailable, instead of a hint. */
  hideWhenUnavailable?: boolean;
};

/**
 * "Install app" control.
 *
 * Three states, because a single button would be a lie on two of them:
 *  - installable  → real button that opens the browser's install dialog
 *  - already installed → confirmation, no action
 *  - iOS Safari   → instructions, since Apple exposes no programmatic install
 */
export function InstallButton({
  className,
  variant = "outline",
  size = "lg",
  hideWhenUnavailable = false,
}: InstallButtonProps) {
  const { canInstall, isInstalled, isIOS, promptInstall } = useInstallPrompt();
  const [busy, setBusy] = useState(false);

  if (isInstalled) {
    return (
      <p
        className={cn(
          "flex items-center justify-center gap-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <Check className="size-4 text-status-active" aria-hidden />
        App install ho chuka hai
      </p>
    );
  }

  if (canInstall) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={busy}
        className={cn("touch-target", className)}
        onClick={async () => {
          setBusy(true);
          try {
            await promptInstall();
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download className="size-4" aria-hidden />
        Install app
      </Button>
    );
  }

  if (isIOS) {
    return (
      <p
        className={cn(
          "flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        <Share className="size-4 shrink-0" aria-hidden />
        <span>
          Install karne ke liye <strong className="font-medium">Share</strong> →{" "}
          <strong className="font-medium">Add to Home Screen</strong>
        </span>
      </p>
    );
  }

  if (hideWhenUnavailable) return null;

  // Desktop Firefox, or Chrome before it decides the app is installable.
  return (
    <p className={cn("text-center text-sm text-muted-foreground", className)}>
      Install option aapke browser menu me milega.
    </p>
  );
}
