import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholders.
 *
 * Each one mirrors the shape of the screen it stands in for, so the layout
 * does not jump when the real content arrives. A generic spinner would be
 * less work and a worse experience — the page would reflow under the
 * reader's eyes every time.
 *
 * Everything here is decorative: `aria-hidden` keeps it out of the
 * accessibility tree, and the wrapper announces "loading" once instead of
 * spelling out a dozen grey boxes.
 */

export function LoadingRegion({
  label = "Load ho raha hai",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-52" />
    </div>
  );
}

/** The dashboard's four-step day plus its primary action. */
export function TodayCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-28" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

export function TimelineSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-48 w-full rounded-xl" />

        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <Skeleton className="mt-1.5 size-1.5 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** A card with a title and a handful of form rows. */
export function FormCardSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PartnerCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>

        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        ))}

        <Skeleton className="h-11 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

/** The camera preview and its shutter. */
export function CaptureSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="aspect-[3/4] w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-md" />
    </div>
  );
}
