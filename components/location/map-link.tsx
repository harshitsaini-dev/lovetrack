import { ExternalLink, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Opens a captured location in whatever maps app the device has.
 *
 * A `geo:` URI is the native way to say this, but it does nothing at all on
 * a desktop browser and nothing useful on iOS. The Google Maps universal
 * URL is handled by the installed app on both Android and iOS and falls
 * back to the web map everywhere else, so one link works for everyone
 * rather than working brilliantly for some and silently failing for the
 * rest.
 *
 * Six decimal places is roughly 0.1 m — past the precision of any phone
 * GPS, and truncating further would move the pin.
 */
export function mapsUrl(latitude: number, longitude: number): string {
  const query = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function MapLink({
  latitude,
  longitude,
  label,
  className,
}: {
  latitude: number;
  longitude: number;
  /** The place name, when one was resolved. */
  label?: string | null;
  className?: string;
}) {
  const coords = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

  return (
    <a
      href={mapsUrl(latitude, longitude)}
      target="_blank"
      // noreferrer as well as noopener: the path here can contain a partner
      // id, and Google has no business receiving it.
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md py-1.5 text-xs text-primary hover:underline",
        className,
      )}
      // The visible text is often a place name, which on its own does not
      // say that this opens elsewhere.
      aria-label={`${label ?? coords} — maps app me kholein`}
    >
      <MapPin className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label ?? coords}</span>
      <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
    </a>
  );
}
