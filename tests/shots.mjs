// Screenshots of noted in WebKit, framed as an installed iPhone app.
// usage (from tests/): node demo-audio.mjs && node shots.mjs [app dir] [out dir] [width=390] [height=844]
// Defaults: this repo, written to .tools/shots (gitignored).
import { webkit } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(process.argv[2] || path.join(HERE, '..'));
const OUT = path.resolve(process.argv[3] || path.join(HERE, '../.tools/shots'));
const W = +(process.argv[4] || 390), SCREEN_H = +(process.argv[5] || 844);
const SMALL = SCREEN_H < 700;                       // SE class: 20pt status bar, no home indicator
const STATUS = SMALL ? 20 : 47, HOME = SMALL ? 0 : 34;
const APP_H = SCREEN_H - STATUS;                    // status-bar-style "default": app starts under the bar
const DEMO = path.join(HERE, '../.tools/demo');
const TRACKS = ['01 ride home v3.wav', '02 chorus rework.wav', '03 night drive.wav', '04 outro idea.wav'].map(f => path.join(DEMO, f));
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const key = n => 'noted:' + n.replace(/[\s\/\\'"]+/g, '_');
const OLD = Date.now() - 3600e3;
const SEED = {
  [key('01 ride home v3.wav')]: {
    markers: [{ t: 12, name: 'Verse' }, { t: 48, name: 'Chorus' }, { t: 80, name: 'Breakdown' }, { t: 96, name: 'Chorus 2' }, { t: 140, name: 'Bridge' }],
    notes: [
      { id: 'n1', t: 14.2, text: 'Kick feels thin under the bass', tags: ['Low end'], section: 'Verse', done: false },
      { id: 'n2', t: 52.8, text: 'Vocal sits behind the guitars in the chorus', tags: ['Vocals', 'Levels'], section: 'Chorus', done: false },
      { id: 'n3', t: 81.5, text: 'Snare reverb tail is too long', tags: ['FX'], section: 'Breakdown', done: true },
      { id: 'n4', t: 118.0, text: 'Flagged, talk to fill it in.', tags: ['Flagged'], section: 'Chorus 2', done: false, flagged: true, flaggedAt: OLD },
      { id: 'n5', t: 151.4, text: 'Bring the bridge pad in two bars earlier', tags: ['Arrangement'], section: 'Bridge', done: false },
    ],
  },
  [key('02 chorus rework.wav')]: {
    markers: [{ t: 8, name: 'Verse' }, { t: 48, name: 'Chorus' }, { t: 108, name: 'Bridge' }],
    notes: [
      { id: 'm1', t: 22.4, text: 'Hats are harsh above 10k', tags: ['EQ'], section: 'Verse', done: false },
      { id: 'm2', t: 61.0, text: 'Lead vocal needs a touch more air', tags: ['Vocals'], section: 'Chorus', done: true },
      { id: 'm3', t: 114.8, text: 'Bass drops out under the bridge pad', tags: ['Low end', 'Arrangement'], section: 'Bridge', done: false },
    ],
  },
};

const INIT = `(() => {
  const W = window;
  W.__sr = { active: null };
  class FakeSR { start(){ W.__sr.active = this; } abort(){ W.__sr.active = null; } stop(){ W.__sr.active = null; } }
  W.SpeechRecognition = FakeSR; W.webkitSpeechRecognition = FakeSR;
  W.__say = t => { const s = W.__sr.active; if (!s || !s.onresult) return false; const r = [{ transcript: t }]; r.isFinal = false; s.onresult({ results: [r] }); return true; };
  try { if (!localStorage.getItem('noted:__seeded')) { const S = ${JSON.stringify(SEED)}; for (const k in S) localStorage.setItem(k, JSON.stringify(S[k])); localStorage.setItem('noted:__seeded', '1'); } } catch (e) {}
})();`;
// The device's bottom safe area, which a desktop engine reports as 0.
const SAFE = HOME ? `
  #noteBtn{margin-bottom:${HOME + 4}px !important}
  #listenOverlay{padding-bottom:${HOME + 28}px !important}
  #sheet{padding-bottom:${HOME + 20}px !important}
  .lp-hero{padding-bottom:${56 + HOME}px !important}
  .lp-scroll{bottom:${24 + HOME}px !important}` : '';

const browser = await webkit.launch({ headless: true });
async function app(viewH = APP_H) {
  const ctx = await browser.newContext({ viewport: { width: W, height: viewH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript({ content: INIT });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await page.goto(BASE + 'index.html'); await page.waitForLoadState('load');
  if (SAFE) await page.addStyleTag({ content: SAFE });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}
const until = (page, expr, timeout = 8000) => page.waitForFunction(expr, null, { timeout, polling: 50 });

async function frame(raw, out, { bar = '#B8F06E', ink = '#141310', home = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: SCREEN_H }, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  const img = 'data:image/png;base64,' + fs.readFileSync(raw).toString('base64');
  await p.setContent(`<!doctype html><style>
    html,body{margin:0;width:${W}px;height:${SCREEN_H}px;overflow:hidden;background:${bar}}
    .sb{height:${STATUS}px;display:flex;align-items:center;justify-content:space-between;padding:0 ${SMALL ? 8 : 30}px 0 ${SMALL ? 8 : 36}px;
        font:600 ${SMALL ? 12 : 17}px -apple-system,system-ui;color:${ink};box-sizing:border-box}
    .ic{display:flex;gap:6px;align-items:center}
    img{display:block;width:${W}px}
    .home{position:absolute;left:50%;bottom:8px;width:134px;height:5px;margin-left:-67px;border-radius:3px;background:${ink}}
  </style>
  <div class="sb"><span>9:41</span><span class="ic">
    <svg width="18" height="12" viewBox="0 0 18 12"><g fill="${ink}"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></g></svg>
    <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.2-1.2A10.3 10.3 0 0 0 8 .5 10.3 10.3 0 0 0 .6 3.5l1.2 1.2A8.7 8.7 0 0 1 8 2.2zm0 3.4c1.5 0 2.8.6 3.8 1.5l1.2-1.2A7 7 0 0 0 8 3.9a7 7 0 0 0-5 2l1.2 1.2c1-.9 2.3-1.5 3.8-1.5zm0 3.4c.6 0 1.1.2 1.5.6L8 11.1 6.5 9.6c.4-.4.9-.6 1.5-.6z" fill="${ink}"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="${ink}" opacity=".4"/><rect x="2" y="2" width="18" height="9" rx="2" fill="${ink}"/><rect x="24.5" y="4.5" width="1.5" height="4" rx=".75" fill="${ink}" opacity=".4"/></svg>
  </span></div><img src="${img}">${home && HOME ? '<div class="home"></div>' : ''}`);
  await p.screenshot({ path: out });
  await ctx.close();
}
const tmp = n => path.join(OUT, '.raw-' + n + '.png');
const tag = `${W}`;

/* 1. landing */
{
  const { ctx, page } = await app();
  await page.waitForTimeout(3200);
  await page.screenshot({ path: tmp('landing') });
  await frame(tmp('landing'), path.join(OUT, `1-landing-${tag}.png`));
  await page.screenshot({ path: path.join(OUT, `1b-landing-full-${tag}.png`), fullPage: true });
  await ctx.close();
}

/* 2 + 3. player playing a 4-track queue, then the listening overlay */
{
  const { ctx, page } = await app();
  await page.setInputFiles('#fileInput', TRACKS);
  await until(page, 'queue.length===4 && qIndex===0 && dur>100');
  await page.click('#playBtn'); await until(page, 'isPlaying()');
  await page.evaluate('seek(84.2)');
  await until(page, 'peaks!==null', 15000);
  await until(page, "$('toast').style.display!=='block'");
  await page.waitForTimeout(600);
  await page.screenshot({ path: tmp('playing') });
  await frame(tmp('playing'), path.join(OUT, `2-player-playing-${tag}.png`));
  await page.click('#noteBtn');
  await until(page, "listenState==='listening'");
  await page.evaluate("__say('Kick is fighting the bass in the drop')");
  await page.waitForTimeout(500);
  await page.screenshot({ path: tmp('overlay') });
  await frame(tmp('overlay'), path.join(OUT, `3-listening-overlay-${tag}.png`));
  await page.click('#loSave'); await until(page, "isPlaying() && $('toast').style.display!=='block'");
  await page.click('#queueTab'); await page.waitForTimeout(300);
  await page.screenshot({ path: tmp('queue') });
  await frame(tmp('queue'), path.join(OUT, `x-queue-tab-${tag}.png`));
  await ctx.close();
}

/* 2b. player playing, three notes, single track; 2c. playing, no notes */
{
  const { ctx, page } = await app();
  await page.setInputFiles('#fileInput', [TRACKS[1]]);
  await until(page, 'qIndex===0 && dur>100 && notes.length===3');
  await page.click('#playBtn'); await until(page, 'isPlaying()');
  await page.evaluate('seek(63.6)'); await until(page, 'peaks!==null', 15000);
  await until(page, "$('toast').style.display!=='block'"); await page.waitForTimeout(400);
  await page.screenshot({ path: tmp('p3') });
  await frame(tmp('p3'), path.join(OUT, `2b-player-3-notes-${tag}.png`));
  await ctx.close();
}
{
  const { ctx, page } = await app();
  await page.setInputFiles('#fileInput', [TRACKS[3]]);
  await until(page, 'qIndex===0 && dur>60');
  await page.click('#playBtn'); await until(page, 'isPlaying()');
  await page.evaluate('seek(41.2)'); await until(page, 'peaks!==null', 15000);
  await until(page, "$('toast').style.display!=='block'"); await page.waitForTimeout(400);
  await page.screenshot({ path: tmp('p0') });
  await frame(tmp('p0'), path.join(OUT, `2c-player-empty-${tag}.png`));
  await ctx.close();
}

/* 4. notes list on a single track */
{
  const { ctx, page } = await app();
  await page.setInputFiles('#fileInput', [TRACKS[0]]);
  await until(page, 'qIndex===0 && dur>100 && notes.length===5');
  await page.evaluate('seek(97.4)');
  await until(page, 'peaks!==null', 15000);
  await until(page, "$('toast').style.display!=='block'");
  await page.waitForTimeout(300);
  await page.screenshot({ path: tmp('notes') });
  await frame(tmp('notes'), path.join(OUT, `4-notes-${tag}.png`));
  // extra, for review: the edit sheet and an empty track
  await page.locator('#noteList .note').nth(1).locator('.txt').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: tmp('sheet') });
  await frame(tmp('sheet'), path.join(OUT, `x-edit-sheet-${tag}.png`));
  await ctx.close();
}
{
  const { ctx, page } = await app();
  await page.setInputFiles('#fileInput', [TRACKS[3]]);
  await until(page, 'qIndex===0 && dur>60'); await until(page, 'peaks!==null', 15000);
  await page.waitForTimeout(300);
  await page.screenshot({ path: tmp('empty') });
  await frame(tmp('empty'), path.join(OUT, `x-empty-notes-${tag}.png`));
  await ctx.close();
}

/* 5. lock screen card + 6. home screen icon (mock iOS chrome around the real files) */
if (!SMALL) {
  const art = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'artwork.png')).toString('base64');
  const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'apple-touch-icon.png')).toString('base64');
  const ctx = await browser.newContext({ viewport: { width: W, height: SCREEN_H }, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><style>
    body{margin:0;height:${SCREEN_H}px;overflow:hidden;font-family:-apple-system,system-ui;color:#fff;
      background:radial-gradient(120% 70% at 30% 10%,#3b4a5e,#1b2230 60%,#0e1219)}
    .date{text-align:center;margin-top:78px;font-size:20px;font-weight:600;opacity:.9}
    .time{text-align:center;font-size:96px;font-weight:700;letter-spacing:-2px;line-height:1;margin-top:2px}
    .card{position:absolute;left:12px;right:12px;bottom:118px;border-radius:24px;padding:16px;
      background:rgba(60,64,72,.55);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
    .row{display:flex;gap:12px;align-items:center}
    .row img{width:56px;height:56px;border-radius:10px}
    .t{font-size:15px;font-weight:600}.a{font-size:15px;opacity:.6}
    .bar{height:4px;border-radius:2px;background:rgba(255,255,255,.25);margin:16px 0 6px;position:relative}
    .bar i{position:absolute;left:0;top:0;bottom:0;width:38%;border-radius:2px;background:rgba(255,255,255,.85)}
    .tm{display:flex;justify-content:space-between;font-size:11px;opacity:.55}
    .ctl{display:flex;justify-content:center;gap:56px;margin-top:10px;font-size:30px}
    .big{position:absolute;left:50%;top:256px;width:250px;height:250px;margin-left:-125px;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.45)}
  </style>
  <div class="date">Thursday 30 October</div><div class="time">9:41</div>
  <img class="big" src="${art}">
  <div class="card"><div class="row"><img src="${art}"><div><div class="t">01 ride home v3.wav</div><div class="a">noted 1.0 · 1 / 4</div></div></div>
    <div class="bar"><i></i></div><div class="tm"><span>1:24</span><span>−2:18</span></div>
    <div class="ctl"><span>⏮</span><span>⏸</span><span>⏭</span></div></div>`);
  await p.screenshot({ path: path.join(OUT, `5-lock-screen-${tag}.png`) });
  const grid = ['#ff6b5e', '#5ac8fa', '#ffcc00', '#34c759', '#af52de', '#ff9500', '#5856d6', '#ff2d55', '#64d2ff', '#30d158', '#bf5af2'];
  const labels = ['Calendar', 'Weather', 'Notes', 'Maps', 'Podcasts', 'Books', 'Files', 'Music', 'Camera', 'Clock', 'Voice Memos'];
  const cells = [];
  for (let k = 0; k < 12; k++) {
    if (k === 6) cells.push(`<div class="app"><img src="${icon}"><span>noted 1.0</span></div>`);
    else { const j = k > 6 ? k - 1 : k; cells.push(`<div class="app"><div class="ph" style="background:${grid[j]}"></div><span>${labels[j]}</span></div>`); }
  }
  await p.setContent(`<!doctype html><style>
    body{margin:0;height:${SCREEN_H}px;overflow:hidden;font-family:-apple-system,system-ui;
      background:radial-gradient(120% 80% at 70% 0%,#4d6b8a,#24384f 55%,#121c28)}
    .g{display:grid;grid-template-columns:repeat(4,64px);justify-content:space-between;row-gap:28px;padding:84px 28px 0}
    .app{display:flex;flex-direction:column;align-items:center;gap:6px}
    .app img,.ph{width:64px;height:64px;border-radius:15px;opacity:1}
    .ph{opacity:.55}
    .app span{font-size:12px;color:#fff;white-space:nowrap}
    .zoom{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);display:flex;gap:28px;align-items:end}
    .zoom div{display:flex;flex-direction:column;align-items:center;gap:8px;color:#fff;font-size:11px;opacity:.9}
    .zoom img{display:block}
  </style><div class="g">${cells.join('')}</div>
  <div class="zoom">
    <div><img src="${icon}" style="width:180px;height:180px;border-radius:40px">180 pt (as installed)</div>
  </div>`);
  await p.screenshot({ path: path.join(OUT, `6-home-screen-${tag}.png`) });
  await ctx.close();
}

for (const f of fs.readdirSync(OUT)) if (f.startsWith('.raw-')) fs.unlinkSync(path.join(OUT, f));
await browser.close(); server.close();
console.log(fs.readdirSync(OUT).filter(f => f.includes(tag)).join('\n'));
