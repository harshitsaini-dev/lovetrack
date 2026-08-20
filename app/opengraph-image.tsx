import { ImageResponse } from "next/og";

export const alt =
  "LoveTrack — consent-based attendance and activity verification";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card people see when a LoveTrack link is pasted into WhatsApp, Slack
 * or a social post.
 *
 * Generated rather than shipped as a binary so it stays in sync with the
 * brand, and so the repository carries no large image asset. Only inline
 * styles work here — ImageResponse renders a Satori subset, not the DOM.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(150deg, #FFF8FB 0%, #FFE7EF 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <svg width="96" height="96" viewBox="0 0 24 24">
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

          <div
            style={{
              display: "flex",
              fontSize: 86,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#3B1220",
            }}
          >
            Love
            <span style={{ color: "#E11D48" }}>Track</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 36,
            fontSize: 40,
            lineHeight: 1.35,
            color: "#6B4453",
            maxWidth: 900,
          }}
        >
          Attendance &amp; activity verification for couples and friends —
          live camera proof, genuine location, and sharing you control.
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            color: "#9B7183",
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "#22A06B",
            }}
          />
          Consent-based · never hidden tracking
        </div>
      </div>
    ),
    size,
  );
}
