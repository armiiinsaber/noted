// Layout audit in WebKit: every multi-line text block must have balanced lines
// (no short trailing line), and the session must fit one viewport.
// usage (from tests/): node demo-audio.mjs && node audit.mjs [app dir, default: the repo]
import { webkit } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] || path.join(HERE, '..'));
const DEMO = path.join(HERE, '../.tools/demo');
const T = f => path.join(DEMO, f);
const MIME = { '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.js': 'text/javascript' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const key = n => 'noted:' + n.replace(/[\s\/\\'"]+/g, '_');
const SEED = { [key('01 ride home v3.wav')]: { markers: [{ t: 12, name: 'Verse' }, { t: 48, name: 'Chorus' }, { t: 80, name: 'Breakdown' }], notes: [
  { id: 'a', t: 14, text: 'Kick feels thin under the bass', tags: ['Low end'], section: 'Verse' },
  { id: 'b', t: 52, text: 'Vocal sits behind the guitars in the chorus', tags: ['Vocals', 'Levels'], section: 'Chorus' },
  { id: 'c', t: 81, text: 'Snare reverb tail is too long', tags: ['FX'], section: 'Breakdown', done: true },
  { id: 'd', t: 118, text: 'Flagged, talk to fill it in.', tags: ['Flagged'], flagged: true, flaggedAt: 1 }] } };
const INIT = `(() => { const W = window; W.__sr = { active: null };
  class FakeSR { start(){ W.__sr.active = this; } abort(){ W.__sr.active = null; } stop(){ W.__sr.active = null; } }
  W.SpeechRecognition = FakeSR; W.webkitSpeechRecognition = FakeSR;
  W.__say = t => { const s = W.__sr.active; if (!s || !s.onresult) return; const r = [{ transcript: t }]; s.onresult({ results: [r] }); };
  try { if (!localStorage.getItem('noted:__seeded')) { const S = ${JSON.stringify(SEED)}; for (const k in S) localStorage.setItem(k, JSON.stringify(S[k])); localStorage.setItem('noted:__seeded', '1'); } } catch (e) {} })();`;

// In-page: lines of every visible text block, measured word by word.
const MEASURE = () => {
  const out = [];
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0; };
  const owners = new Set();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) { const n = tw.currentNode; if (!n.textContent.trim()) continue;
    let e = n.parentElement; if (!e || e.closest('script,style,svg,#dbgOverlay')) continue;
    // measure at the block that wraps: the nearest ancestor that is not inline
    while (e && getComputedStyle(e).display.startsWith('inline') && e.parentElement) e = e.parentElement;
    if (e && vis(e)) owners.add(e); }
  for (const e of owners) {
    const words = []; const w2 = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    while (w2.nextNode()) { const n = w2.currentNode; if (n.parentElement.closest('svg')) continue;
      const re = /\S+/g; let m; while ((m = re.exec(n.textContent))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const b = r.getBoundingClientRect(); if (b.width) words.push({ w: m[0], top: b.top + b.height * .25, bot: b.bottom - b.height * .25, l: b.left, r: b.right }); } }
    if (!words.length) continue;
    const lines = [];
    // same line = vertical overlap (mixed sizes on one baseline have different tops)
    for (const w of words) { let L = lines.find(x => w.top < x.bot && w.bot > x.top); if (!L) lines.push(L = { top: w.top, bot: w.bot, words: [], l: 1e9, r: -1e9 }); L.top = Math.min(L.top, w.top); L.bot = Math.max(L.bot, w.bot); L.words.push(w.w); L.l = Math.min(L.l, w.l); L.r = Math.max(L.r, w.r); }
    lines.sort((a, b) => a.top - b.top);
    if (lines.length < 2) continue;
    const widths = lines.map(L => L.r - L.l), max = Math.max(...widths), min = Math.min(...widths);
    const last = lines.at(-1);
    const id = e.id ? '#' + e.id : e.className ? '.' + String(e.className).split(' ')[0] : e.tagName.toLowerCase();
    const user = !!e.closest('.note .txt,.lo-transcript,.qName,.trackName,.tgName');
    out.push({ id, user, text: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 80), lines: lines.map(L => L.words.join(' ')),
      ratio: +(min / max).toFixed(2), lastWords: last.words.length });
  }
  return out;
};
const FIT = () => {
  const vw = innerWidth, vh = innerHeight, se = document.scrollingElement;
  const over = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    if (!r.width || cs.position === 'fixed' || e.closest('#listenOverlay,#sheet,#sheetBack,#dbgOverlay,#toast,svg')) return false;
    if (e.closest('#queueList,#noteList') ) return false;
    return r.right > vw + 0.5 || r.left < -0.5 || r.bottom > vh + 0.5; }).map(e => (e.id ? '#' + e.id : e.className ? '.' + String(e.className).split(' ')[0] : e.tagName) + ' ' + Math.round(e.getBoundingClientRect().right) + 'x' + Math.round(e.getBoundingClientRect().bottom));
  const nb = document.getElementById('noteBtn').getBoundingClientRect();
  const nl = [...document.querySelectorAll('#noteList,#queueList')].map(e => e.getBoundingClientRect().height).reduce((a, b) => Math.max(a, b), 0);
  return { pageScroll: se.scrollHeight - vh, hScroll: se.scrollWidth - vw, noteBtnBottomGap: Math.round(vh - nb.bottom), listHeight: Math.round(nl), overflow: over.slice(0, 8) };
};

const browser = await webkit.launch();
const fails = [], report = [];
async function audit(width, height, label) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript({ content: INIT });
  const page = await ctx.newPage(); await page.goto(BASE + 'index.html'); await page.evaluate(() => document.fonts.ready);
  const states = [];
  const take = async name => states.push([name, await page.evaluate(MEASURE)]);
  await page.waitForTimeout(300); await take('landing');
  await page.setInputFiles('#fileInput', [T('04 outro idea.wav')]); await page.waitForFunction('qIndex===0 && dur>0');
  await page.waitForTimeout(300); await take('player, no notes');
  report.push([label, 'fit, single track', await page.evaluate(FIT)]);
  await page.setInputFiles('#fileInput', [T('01 ride home v3.wav')]); await page.waitForFunction('qIndex===0 && dur>0 && notes.length===4');
  await page.waitForTimeout(300); await take('player, notes');
  await page.click('#exportBtn'); await page.waitForTimeout(100); await take('toast');
  await page.locator('#noteList .note').nth(1).locator('.txt').click(); await page.waitForTimeout(200); await take('edit sheet');
  await page.click('#cancelNote');
  await page.setInputFiles('#fileInput2', [T('02 chorus rework.wav'), T('03 night drive.wav'), T('04 outro idea.wav')]);
  await page.waitForFunction('queue.length===4'); await page.waitForTimeout(300);
  report.push([label, 'fit, queue (notes tab)', await page.evaluate(FIT)]);
  await page.click('#queueTab'); await page.waitForTimeout(200); await take('queue tab');
  report.push([label, 'fit, queue (queue tab)', await page.evaluate(FIT)]);
  await page.click('#playBtn'); await page.waitForFunction('isPlaying()'); await page.waitForTimeout(400);
  await page.click('#noteBtn'); await page.waitForFunction("listenState==='listening'");
  await take('overlay, empty');
  await page.evaluate("__say('Kick is fighting the bass in the drop and the low end gets muddy')"); await page.waitForTimeout(100);
  await take('overlay, transcript');
  report.push([label, 'fit, listening overlay', await page.evaluate(() => { const t = document.querySelector('.lo-eyebrow').getBoundingClientRect().top, b = document.getElementById('loSave').getBoundingClientRect().bottom; return { eyebrowTop: Math.round(t), saveBottomGap: Math.round(innerHeight - b) }; })]);
  for (const [state, items] of states) for (const it of items) {
    const bad = it.lastWords < 2 || it.ratio < 0.6;
    if (bad) fails.push({ width, state, ...it });
  }
  report.push([label, 'blocks checked', states.reduce((a, [, x]) => a + x.length, 0) + ' multi-line blocks']);
  await ctx.close();
}
await audit(390, 797, '390x797 (iPhone 14/15/16, installed)');
await audit(375, 647, '375x647 (iPhone SE, installed)');
await audit(320, 548, '320x548 (narrowest)');
await browser.close(); server.close();
for (const r of report) console.log(r[0].padEnd(38), r[1].padEnd(24), typeof r[2] === 'string' ? r[2] : JSON.stringify(r[2]));
console.log(fails.length ? `\n${fails.length} unbalanced block(s):` : '\nAll multi-line text blocks balanced (no short trailing line, lines within 60% of each other).');
for (const f of fails) console.log(`  [${f.width}] ${f.state} ${f.id}${f.user ? ' (user text)' : ''} ratio=${f.ratio} last=${f.lastWords}w :: ${JSON.stringify(f.lines)}`);
