// Contact sheet of the six review screens. usage (from tests/): node sheet.mjs [shots dir] [out png]
import { chromium } from 'playwright-core'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const D = path.resolve(process.argv[2] || path.join(HERE, '../.tools/shots')), OUT = process.argv[3] || path.join(D, '0-contact-sheet-390.png');
const items = [['1-landing-390.png','Landing'],['2-player-playing-390.png','Player, playing'],['3-listening-overlay-390.png','Listening overlay'],
  ['4-notes-390.png','Notes list'],['5-lock-screen-390.png','Lock screen artwork'],['6-home-screen-390.png','Home screen icon']];
const cells = items.map(([f,l]) => `<figure><img src="data:image/png;base64,${fs.readFileSync(D+'/'+f).toString('base64')}"><figcaption>${l}</figcaption></figure>`).join('');
const b = await chromium.launch({ channel: 'chrome' }); const p = await b.newPage({ viewport: { width: 1060, height: 1500 }, deviceScaleFactor: 2 });
await p.setContent(`<!doctype html><style>body{margin:0;padding:28px;background:#fff;font:600 15px -apple-system,system-ui;color:#141310}
.g{display:grid;grid-template-columns:repeat(3,320px);gap:30px 22px}figure{margin:0}img{width:320px;border-radius:26px;box-shadow:0 0 0 1px #0002}
figcaption{margin-top:10px;text-align:center}</style><div class="g">${cells}</div>`);
await p.screenshot({ path: OUT, fullPage: true }); await b.close();
