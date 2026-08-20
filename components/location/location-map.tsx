"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

export type MapPoint = {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  label?: string | null;
};

type LocationMapProps = {
  points: MapPoint[];
  className?: string;
  /** Non-interactive by default — these are small inline previews. */
  interactive?: boolean;
  zoom?: number;
};

/**
 * A small OpenStreetMap view of where a capture happened.
 *
 * Leaflet is loaded dynamically and only in the browser: it reaches for
 * `window` at import time, so a static import would break server rendering.
 *
 * Markers are drawn as HTML rather than Leaflet's default icon, whose
 * bundled image URLs break under most bundlers — and this way the pin
 * matches the app's rose theme.
 *
 * Note this is a snapshot, never a live position. LoveTrack does not track
 * anyone; every pin here is a place a capture already happened.
 */
export function LocationMap({
  points,
  className,
  interactive = false,
  zoom = 16,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    let cancelled = false;

    async function render() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      // Tear down any previous instance — React may re-run this effect and
      // Leaflet refuses to initialise twice on the same container.
      mapRef.current?.remove();

      const map = L.map(containerRef.current, {
        zoomControl: interactive,
        scrollWheelZoom: interactive,
        dragging: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        keyboard: interactive,
        attributionControl: true,
      });

      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const pin = L.divIcon({
        className: "",
        html: `<span style="
          display:block;width:14px;height:14px;border-radius:9999px;
          background:#E11D48;border:3px solid #fff;
          box-shadow:0 1px 4px rgba(0,0,0,.4);
        "></span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const latLngs = points.map((p) => {
        const marker = L.marker([p.latitude, p.longitude], {
          icon: pin,
          keyboard: false,
          // Screen readers get the place name from the text beside the map,
          // so the marker itself stays out of the accessibility tree.
          alt: "",
        }).addTo(map);

        if (p.label) marker.bindTooltip(p.label);

        // The accuracy circle is the honest part of the picture: it shows
        // how precisely the position was actually known.
        if (p.accuracyM && p.accuracyM > 0) {
          L.circle([p.latitude, p.longitude], {
            radius: p.accuracyM,
            color: "#E11D48",
            weight: 1,
            fillColor: "#E11D48",
            fillOpacity: 0.12,
          }).addTo(map);
        }

        return [p.latitude, p.longitude] as [number, number];
      });

      if (latLngs.length === 1) {
        map.setView(latLngs[0], zoom);
      } else {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [28, 28] });
      }
    }

    render();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [points, interactive, zoom]);

  if (points.length === 0) return null;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={
        points.length === 1
          ? `Map: ${points[0].label ?? "capture ki gayi jagah"}`
          : `Map: ${points.length} jagah`
      }
      className={cn(
        "z-0 h-40 w-full overflow-hidden rounded-xl border bg-muted",
        className,
      )}
    />
  );
}
