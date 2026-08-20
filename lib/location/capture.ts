/**
 * One-time location capture.
 *
 * LoveTrack never tracks anyone: this is called once, when the user presses
 * a check-in / check-out / lunch button, and never again. `watchPosition`
 * is deliberately absent from the codebase.
 */

export type CapturedLocation = {
  latitude: number;
  longitude: number;
  accuracyM: number;
  /** How old the fix was when we received it, in seconds. */
  fixAgeS: number;
};

export type LocationFailure =
  | "unsupported"
  | "permission_denied"
  | "unavailable"
  | "timeout";

export class LocationError extends Error {
  constructor(readonly kind: LocationFailure) {
    super(kind);
    this.name = "LocationError";
  }
}

/** User-facing explanation for each failure, in the app's voice. */
export const LOCATION_ERROR_MESSAGES: Record<LocationFailure, string> = {
  unsupported: "Aapka browser location support nahi karta.",
  permission_denied:
    "Location permission chahiye. Browser settings me ise allow karein.",
  unavailable:
    "Location nahi mil payi. Khuli jagah par jaakar dobara try karein.",
  timeout: "Location lene me zyada waqt lag gaya. Dobara try karein.",
};

export function getLocationErrorMessage(error: unknown): string {
  if (error instanceof LocationError) {
    return LOCATION_ERROR_MESSAGES[error.kind];
  }
  return LOCATION_ERROR_MESSAGES.unavailable;
}

/**
 * Reads a single fresh position.
 *
 * `maximumAge: 0` is the important part — without it the browser happily
 * hands back a cached fix from somewhere the user no longer is, which would
 * quietly defeat the whole location check.
 */
export function captureLocation(
  timeoutMs = 20_000,
): Promise<CapturedLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new LocationError("unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // position.timestamp is the device clock, which we do not trust as
        // a time. The *difference* from the device's own "now" is still a
        // useful staleness signal, because both readings share that clock.
        const ageMs = Math.max(0, Date.now() - position.timestamp);

        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          fixAgeS: ageMs / 1000,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new LocationError("permission_denied"));
        } else if (error.code === error.TIMEOUT) {
          reject(new LocationError("timeout"));
        } else {
          reject(new LocationError("unavailable"));
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      },
    );
  });
}
