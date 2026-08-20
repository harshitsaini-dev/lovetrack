import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS does not respect transparency or SVG for home-screen icons — it
 * composites them onto white and squares them off. So this one is drawn
 * with its own blush background rather than reusing icon.svg.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #FFF1F5 0%, #FFE4EC 100%)",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 24 24">
          <defs>
            <linearGradient id="rose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
          </defs>
          <path
            fill="url(#rose)"
            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
          />
        </svg>
      </div>
    ),
    size,
  );
}
