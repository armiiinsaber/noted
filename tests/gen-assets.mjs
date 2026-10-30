// Builds noted's brand files from one vector: the wave mark.
// usage (from tests/): node gen-assets.mjs [repo dir, default: this repo]
//
// Output: icon.svg, favicon.svg, favicon-32.png, apple-touch-icon.png (180),
// icon-192/512/1024.png (maskable: the mark sits inside the safe zone), and
// art/artwork-{96..2048}.png for the lock screen card (artwork.png stays as
// the 512 for anything that still asks for it). Each PNG is rendered at its
// own size by Chrome, never scaled from another.
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const GROUND = '#B8F06E', INK = '#141310';

// One smooth curve: flat start, rise, deep dip, tall peak, settle to flat.
// Every join has collinear handles, so the stroke is tangent-continuous and
// never shows a corner. Extent x 10..110, y 8..52.
const MASTER = 'M10 36 L30 36 C35 36 37 24 43 24 C49 24 50 52 56 52 C62 52 63 8 71 8 C79 8 80 42 86 42 C90 42 92 36 97 36 L110 36';
// Compact cut for 16 to 40px: shorter flats, same gesture. Extent x 20..104, y 6..54.
const COMPACT = 'M20 36 L29 36 C34 36 36 24 42 24 C48 24 49 54 56 54 C63 54 64 6 72 6 C80 6 81 42 87 42 C91 42 93 36 98 36 L104 36';

function square(S, { widthFrac, strokePx, compact = false, radius = 0 }) {
  const d = compact ? COMPACT : MASTER;
  const [x0, x1, y0, y1] = compact ? [20, 104, 6, 54] : [10, 110, 8, 52];
  const k = (S * widthFrac) / (x1 - x0);
  const tx = (S - (x1 - x0) * k) / 2 - x0 * k;
  const ty = (S - (y1 - y0) * k) / 2 - y0 * k;
  const r = (n) => +n.toFixed(4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" role="img" aria-label="noted">
  <rect width="${S}" height="${S}"${radius ? ` rx="${r(S * radius)}"` : ''} fill="${GROUND}"/>
  <path d="${d}" transform="translate(${r(tx)} ${r(ty)}) scale(${r(k)})" fill="none" stroke="${INK}" stroke-width="${r(strokePx / k)}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
}
// Stroke as a share of the side, with a touch more weight below 200px so
// the line never thins out, and never below 3px.
const artStroke = S => Math.max(3, S * 0.035 + (S < 200 ? 0.8 : 0));
const iconStroke = S => Math.max(3, S * 0.031 + (S < 200 ? 0.8 : 0));

// Maskable: the mark at 60% width stays inside the safe circle (r = 40%).
const files = {
  'icon.svg': square(512, { widthFrac: 0.60, strokePx: iconStroke(512) }),
  'favicon.svg': square(64, { widthFrac: 0.80, strokePx: 7.4, compact: true, radius: 0.22 }),
};
for (const [f, svg] of Object.entries(files)) fs.writeFileSync(path.join(OUT, f), svg);

const ART_SIZES = [96, 128, 192, 256, 384, 512, 1024, 2048];
fs.mkdirSync(path.join(OUT, 'art'), { recursive: true });
const pngs = [
  ['icon-1024.png', 1024, { widthFrac: 0.60, strokePx: iconStroke(1024) }],
  ['icon-512.png', 512, { widthFrac: 0.60, strokePx: iconStroke(512) }],
  ['icon-192.png', 192, { widthFrac: 0.60, strokePx: iconStroke(192) }],
  ['apple-touch-icon.png', 180, { widthFrac: 0.60, strokePx: iconStroke(180) }],
  ['favicon-32.png', 32, { widthFrac: 0.82, strokePx: 3.6, compact: true, radius: 0.22 }],
  ...ART_SIZES.map(S => [`art/artwork-${S}.png`, S, { widthFrac: 0.56, strokePx: artStroke(S) }]),
];
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const [name, S, opt] of pngs) {
  const p = await b.newPage({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;shape-rendering:geometricPrecision}</style>${square(S, opt)}`);
  await p.screenshot({ path: path.join(OUT, name), omitBackground: !!opt.radius });
  await p.close();
}
await b.close();
fs.copyFileSync(path.join(OUT, 'art/artwork-512.png'), path.join(OUT, 'artwork.png'));
console.log('wrote', Object.keys(files).concat(pngs.map(x => x[0]), 'artwork.png').join(', '));
