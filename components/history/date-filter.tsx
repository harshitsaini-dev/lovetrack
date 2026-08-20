import Link from "next/link";
import { CalendarRange, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Narrowing history to a date range.
 *
 * A plain GET form with no client JavaScript: the range lives in the URL, so
 * a filtered view can be reloaded, bookmarked or sent to someone, and the
 * back button does what it looks like it does. A client-side filter would
 * lose all three and gain nothing here.
 */
export function DateFilter({
  from,
  to,
  /** Where to submit — the current page. */
  action,
}: {
  from?: string;
  to?: string;
  action: string;
}) {
  const active = Boolean(from || to);

  return (
    <form action={action} className="space-y-2 rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <CalendarRange className="size-4 shrink-0 text-primary" aria-hidden />
        Date se filter karein
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="from" className="text-xs">
            Se
          </Label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={from ?? ""}
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="to" className="text-xs">
            Tak
          </Label>
          <Input
            id="to"
            name="to"
            type="date"
            defaultValue={to ?? ""}
            className="h-11"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="touch-target w-full sm:flex-1">
          Filter karein
        </Button>

        {/*
          A link rather than a reset button: reset would only clear the
          inputs and leave the filtered results on screen, which reads as
          the control being broken.
        */}
        {active && (
          <Button
            asChild
            variant="outline"
            className="touch-target w-full sm:flex-1"
          >
            <Link href={action}>
              <X className="size-4" aria-hidden />
              Filter hatayein
            </Link>
          </Button>
        )}
      </div>
    </form>
  );
}
