import "server-only";

/**
 * Turns coordinates into a place people recognise — "Janakpuri, New Delhi"
 * rather than "28.62051, 77.05213".
 *
 * Runs on the server, never in the browser. Nominatim's usage policy asks
 * for an identifying User-Agent and no more than one request a second, and
 * neither is possible to honour if every client calls it directly.
 *
 * A failure here is never fatal: the label is presentation, the coordinates
 * are the record.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const TIMEOUT_MS = 4000;

/** Rounded to ~11m, which is finer than any label we render. */
function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

type CacheEntry = { label: string | null; at: number };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

/** Serialises calls so we never exceed one request per second. */
let lastCallAt = 0;
let queue: Promise<unknown> = Promise.resolve();

async function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastCallAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });

  // Keep the chain alive even if this call rejects.
  queue = run.catch(() => undefined);
  return run;
}

type NominatimAddress = {
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  city_district?: string;
  county?: string;
  state?: string;
  country?: string;
};

/** Two parts at most: somewhere specific, then somewhere recognisable. */
function buildLabel(address: NominatimAddress): string | null {
  const local =
    address.neighbourhood ??
    address.suburb ??
    address.village ??
    address.city_district;

  const wider =
    address.city ?? address.town ?? address.county ?? address.state;

  const parts = [local, wider].filter(
    (part, index, all): part is string =>
      Boolean(part) && all.indexOf(part) === index,
  );

  if (parts.length === 0) {
    return address.state ?? address.country ?? null;
  }

  return parts.join(", ");
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const key = cacheKey(latitude, longitude);
  const hit = cache.get(key);

  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.label;

  let label: string | null = null;

  try {
    label = await throttle(async () => {
      const url = new URL(ENDPOINT);
      url.searchParams.set("lat", String(latitude));
      url.searchParams.set("lon", String(longitude));
      url.searchParams.set("format", "jsonv2");
      // zoom 16 lands on a neighbourhood rather than a house number; we do
      // not want to record someone's exact doorstep as a label.
      url.searchParams.set("zoom", "16");
      url.searchParams.set("addressdetails", "1");

      const response = await fetch(url, {
        headers: {
          "User-Agent": "LoveTrack/1.0 (attendance verification PWA)",
          "Accept-Language": "en",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as { address?: NominatimAddress };
      return data.address ? buildLabel(data.address) : null;
    });
  } catch {
    // Offline, rate limited, or slow. Not worth failing a check-in over.
    label = null;
  }

  if (cache.size >= CACHE_MAX) {
    // Cheap eviction: drop the oldest inserted key.
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { label, at: Date.now() });

  return label;
}
