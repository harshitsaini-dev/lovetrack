import { Card, CardContent } from "@/components/ui/card";

/**
 * Placeholder for a route that navigation already links to but whose phase
 * has not landed yet. Better than a 404 — the user sees where the feature
 * will live and which step brings it.
 */
export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <Card className="border-dashed bg-transparent shadow-none">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Ye feature <span className="font-medium text-foreground">{phase}</span>{" "}
            me aa raha hai.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
