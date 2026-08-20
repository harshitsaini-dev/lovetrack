"use client";

/**
 * Last resort: an error in the root layout itself.
 *
 * This replaces the whole document, so it must ship its own <html> and
 * <body> and cannot rely on the app's providers, fonts or stylesheet —
 * none of them are guaranteed to have loaded. Hence the inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#FFF8FB",
          color: "#3B1220",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "22rem" }}>
          <div style={{ fontSize: "40px", lineHeight: 1 }}>💔</div>

          <h1
            style={{
              margin: "16px 0 8px",
              fontSize: "20px",
              fontWeight: 600,
            }}
          >
            LoveTrack load nahi ho paya
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: "14px",
              lineHeight: 1.6,
              color: "#6B4453",
            }}
          >
            Kuch bahut hi galat ho gaya. Page reload karke dekhein.
          </p>

          {error.digest && (
            <p
              style={{
                marginTop: "12px",
                fontSize: "12px",
                fontFamily: "ui-monospace, monospace",
                color: "#9B7183",
              }}
            >
              Reference: {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "20px",
              minHeight: "44px",
              width: "100%",
              borderRadius: "10px",
              border: "none",
              background: "#E11D48",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Dobara try karein
          </button>
        </div>
      </body>
    </html>
  );
}
