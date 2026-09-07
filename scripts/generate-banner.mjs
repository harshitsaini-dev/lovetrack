/**
 * Builds the README banner, in both themes.
 *
 *   node scripts/generate-banner.mjs
 *
 * The colours are the app's own tokens from app/globals.css, converted from
 * OKLCH here rather than eyeballed, so the banner cannot drift away from the
 * product it is advertising. Change a token there, re-run this, and the
 * banner follows.
 *
 * Output is PNG rather than SVG. GitHub sanitises SVG in READMEs and cannot
 * load web fonts, so an SVG banner renders with whatever font the viewer
 * happens to have — the one thing a wordmark cannot tolerate. Rasterising
 * here bakes in the layout everyone then sees.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

// ---------- the app's palette, from OKLCH ----------

function oklchToHex(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return (
    "#" +
    channels
      .map((u) => {
        const v = u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, v)) * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

const THEMES = {
  dark: {
    bg: oklchToHex(0.15, 0.014, 320),
    card: oklchToHex(0.2, 0.016, 320),
    fg: oklchToHex(0.96, 0.008, 340),
    rose: oklchToHex(0.68, 0.185, 13),
    lavender: oklchToHex(0.34, 0.055, 300),
    muted: oklchToHex(0.72, 0.02, 330),
    green: oklchToHex(0.74, 0.15, 150),
    amber: oklchToHex(0.8, 0.14, 65),
    border: "#ffffff",
    borderOpacity: 0.12,
    glow: 0.16,
  },
  light: {
    bg: oklchToHex(0.985, 0.009, 340),
    card: "#ffffff",
    fg: oklchToHex(0.22, 0.02, 330),
    rose: oklchToHex(0.62, 0.185, 13),
    lavender: oklchToHex(0.93, 0.035, 300),
    muted: oklchToHex(0.52, 0.03, 330),
    green: oklchToHex(0.68, 0.15, 150),
    amber: oklchToHex(0.75, 0.14, 65),
    border: oklchToHex(0.9, 0.014, 335),
    borderOpacity: 1,
    glow: 0.1,
  },
};

const W = 1200;
const H = 420;

// The five steps of a LoveTrack day, in order, with the colour each carries
// in the app: green once done, amber through the meal.
const STEPS = [
  { label: "Check-in", time: "09:12 am", tone: "green" },
  { label: "Lunch in", time: "01:30 pm", tone: "amber" },
  { label: "Lunch verify", time: "01:34 pm", tone: "amber", clip: true },
  { label: "Lunch out", time: "02:05 pm", tone: "amber" },
  { label: "Check-out", time: "06:40 pm", tone: "green" },
];

/** A heart, drawn rather than imported — it is the app's icon. */
const HEART =
  "M12 21s-7.5-4.7-9.5-9.1C1 8.6 2.6 5 6.2 5c2 0 3.4 1.1 4.3 2.3l1.5 2 " +
  "1.5-2C14.4 6.1 15.8 5 17.8 5c3.6 0 5.2 3.6 3.7 6.9C19.5 16.3 12 21 12 21z";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

function banner(t) {
  const cardX = 700;
  const cardY = 64;
  const cardW = 436;
  const cardH = 292;

  const rows = STEPS.map((step, i) => {
    const y = cardY + 62 + i * 46;
    const colour = t[step.tone];

    return `
      ${
        i < STEPS.length - 1
          ? `<line x1="${cardX + 34}" y1="${y + 6}" x2="${cardX + 34}" y2="${y + 40}"
                   stroke="${t.border}" stroke-opacity="${t.borderOpacity}" stroke-width="2"/>`
          : ""
      }
      <circle cx="${cardX + 34}" cy="${y}" r="7" fill="${colour}"/>
      <circle cx="${cardX + 34}" cy="${y}" r="13" fill="${colour}" opacity="0.16"/>
      <text x="${cardX + 60}" y="${y + 5}" font-family="${FONT}" font-size="16"
            font-weight="${step.clip ? 600 : 500}" fill="${t.fg}">${step.label}</text>
      ${
        step.clip
          ? `<rect x="${cardX + 172}" y="${y - 11}" width="46" height="22" rx="7"
                   fill="${t.rose}" opacity="0.16"/>
             <text x="${cardX + 195}" y="${y + 4}" font-family="${FONT}" font-size="11"
                   font-weight="600" fill="${t.rose}" text-anchor="middle">clip</text>`
          : ""
      }
      <text x="${cardX + cardW - 24}" y="${y + 5}" font-family="${MONO}" font-size="15"
            fill="${t.muted}" text-anchor="end">${step.time}</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="LoveTrack — see when your friends start work, break for lunch, and head home">
  <defs>
    <radialGradient id="glow" cx="0.12" cy="0.1" r="0.85">
      <stop offset="0%" stop-color="${t.rose}" stop-opacity="${t.glow}"/>
      <stop offset="100%" stop-color="${t.rose}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.95" cy="1" r="0.7">
      <stop offset="0%" stop-color="${t.rose}" stop-opacity="${t.glow * 0.55}"/>
      <stop offset="100%" stop-color="${t.rose}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>

  <!-- consent badge: the first thing the product says about itself -->
  <rect x="64" y="70" width="268" height="32" rx="16" fill="${t.lavender}"/>
  <text x="84" y="91" font-family="${FONT}" font-size="13" font-weight="600"
        fill="${t.rose}">&#9679;</text>
  <text x="100" y="91" font-family="${FONT}" font-size="13" font-weight="600"
        fill="${t.fg}">Both sides agree. Nothing hidden.</text>

  <!-- wordmark -->
  <g transform="translate(64,132) scale(2.05)">
    <path d="${HEART}" fill="${t.rose}"/>
  </g>
  <text x="122" y="176" font-family="${FONT}" font-size="58" font-weight="700"
        letter-spacing="-1.6" fill="${t.fg}">Love<tspan fill="${t.rose}">Track</tspan></text>

  <text x="64" y="228" font-family="${FONT}" font-size="21" fill="${t.muted}">See when your friends start work, break for</text>
  <text x="64" y="258" font-family="${FONT}" font-size="21" fill="${t.muted}">lunch, and head home.</text>

  <text x="64" y="312" font-family="${FONT}" font-size="15" fill="${t.muted}">Live photo and the location it was made from, on</text>
  <text x="64" y="336" font-family="${FONT}" font-size="15" fill="${t.muted}">every entry. No tracking in between.</text>

  <!-- the day, as the app actually shows it -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="18"
        fill="${t.card}" stroke="${t.border}" stroke-opacity="${t.borderOpacity}"/>
  <text x="${cardX + 24}" y="${cardY + 34}" font-family="${FONT}" font-size="14"
        font-weight="600" fill="${t.muted}" letter-spacing="0.6">AAJ KA DIN</text>
  ${rows}

  <text x="64" y="392" font-family="${MONO}" font-size="13" fill="${t.muted}">
    Next.js 16  ·  Supabase  ·  Vercel  ·  MIT
  </text>
</svg>`;
}

mkdirSync("docs/assets", { recursive: true });

for (const [name, theme] of Object.entries(THEMES)) {
  const svg = banner(theme);
  writeFileSync(`docs/assets/banner-${name}.svg`, svg);

  // 2x, so it stays sharp on the retina displays most people read GitHub on.
  await sharp(Buffer.from(svg), { density: 144 })
    .resize(W * 2, H * 2, { fit: "fill" })
    .png()
    .toFile(`docs/assets/banner-${name}.png`);

  console.log(`docs/assets/banner-${name}.png`);
}
