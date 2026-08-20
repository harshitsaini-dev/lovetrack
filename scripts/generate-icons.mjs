/**
 * Renders the PWA icons referenced by public/manifest.json.
 *
 *   node scripts/generate-icons.mjs
 *
 * Run this again if the brand mark changes. The PNGs are committed, so a
 * normal install/build does not need sharp.
 *
 * Two shapes are produced:
 *  - "any": the heart on a blush background, edge to edge
 *  - "maskable": the same mark inset to ~60% so Android can crop it to a
 *    circle or squircle without clipping the heart
 */

import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const HEART =
  "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";

/** @param {number} size @param {number} scale fraction of the canvas the heart fills */
function svg(size, scale) {
  const heart = size * scale;
  const offset = (size - heart) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF1F5"/>
      <stop offset="100%" stop-color="#FFE0EA"/>
    </linearGradient>
    <linearGradient id="rose" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FB7185"/>
      <stop offset="100%" stop-color="#E11D48"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${heart / 24})">
    <path fill="url(#rose)" d="${HEART}"/>
  </g>
</svg>`;
}

const targets = [
  { file: "icon-192.png", size: 192, scale: 0.68 },
  { file: "icon-512.png", size: 512, scale: 0.68 },
  // Android crops maskable icons hard, so the mark sits well inside the
  // safe zone rather than filling the canvas.
  { file: "icon-maskable-512.png", size: 512, scale: 0.48 },
];

await mkdir("public/icons", { recursive: true });

for (const { file, size, scale } of targets) {
  const png = await sharp(Buffer.from(svg(size, scale))).png().toBuffer();
  await writeFile(`public/icons/${file}`, png);
  console.log(`wrote public/icons/${file} (${size}x${size})`);
}

console.log("\nDone.");
