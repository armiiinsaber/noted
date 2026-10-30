// Builds noted's brand files: icon.svg, favicon.svg and the PNG set.
// usage (from tests/): node gen-assets.mjs [repo dir, default: this repo]
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const GROUND = '#B8F06E', INK = '#141310';
// Master curve: flat start, rise, deep dip, tall peak, settle to flat. Extent x 10..110, y 8..52.
const MASTER = 'M10 36 L30 36 C35 36 37 24 43 24 C49 24 50 52 56 52 C62 52 63 8 71 8 C79 8 80 42 86 42 C90 42 92 36 97 36 L110 36';
// Compact cut for 16-40px: shorter flats, same gesture. Extent x 20..104, y 6..54.
const COMPACT = 'M20 36 L29 36 C34 36 36 24 42 24 C48 24 49 54 56 54 C63 54 64 6 72 6 C80 6 81 42 87 42 C91 42 93 36 98 36 L104 36';

function square(S, { widthFrac, strokePx, compact = false, radius = 0 }) {
  const d = compact ? COMPACT : MASTER;
  const [x0, x1, y0, y1] = compact ? [20, 104, 6, 54] : [10, 110, 8, 52];
  const k = (S * widthFrac) / (x1 - x0);
  const tx = (S - (x1 - x0) * k) / 2 - x0 * k;
  const ty = (S - (y1 - y0) * k) / 2 - y0 * k;
  const r = (n) => +n.toFixed(3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" role="img" aria-label="noted">
  <rect width="${S}" height="${S}"${radius ? ` rx="${r(S * radius)}"` : ''} fill="${GROUND}"/>
  <path d="${d}" transform="translate(${r(tx)} ${r(ty)}) scale(${r(k)})" fill="none" stroke="${INK}" stroke-width="${r(strokePx / k)}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
}
// Mark sits at 60% width: inside the maskable safe circle (r = 40% of the side).
const ICON512 = square(512, { widthFrac: 0.60, strokePx: 16 });
const files = {
  'icon.svg': ICON512,
  'favicon.svg': square(64, { widthFrac: 0.80, strokePx: 7.4, compact: true, radius: 0.22 }),
};
for (const [f, svg] of Object.entries(files)) fs.writeFileSync(path.join(OUT, f), svg);

const pngs = [
  ['icon-512.png', 512, { widthFrac: 0.60, strokePx: 16 }],
  ['icon-192.png', 192, { widthFrac: 0.60, strokePx: 6.6 }],
  ['apple-touch-icon.png', 180, { widthFrac: 0.60, strokePx: 6.4 }],
  ['artwork.png', 512, { widthFrac: 0.56, strokePx: 18 }],
  ['favicon-32.png', 32, { widthFrac: 0.82, strokePx: 3.6, compact: true, radius: 0.22 }],
];
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const [name, S, opt] of pngs) {
  const p = await b.newPage({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${square(S, opt)}`);
  await p.screenshot({ path: path.join(OUT, name), omitBackground: !!opt.radius });
  await p.close();
}
await b.close();
console.log('wrote', Object.keys(files).concat(pngs.map(x => x[0])).join(', '));
