// noted regression suite. Rebuilt from the commit descriptions of the lost
// suites (29-test core, 22 MediaSession, 31 queue, 16 resume-deadlock).
// Usage (from tests/): node regress.mjs [app dir, default: the repo] [group,group]
// Drives real Chrome with a fake mic/SpeechRecognition, a MediaSession spy,
// a controllable visibilityState, and an optional "mic holds the audio
// route" simulation (play() rejects while capture is active, plus a lag).
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] || path.join(HERE, '..'));
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const AUDIO = path.join(HERE, '../.tools/fixtures');   // generated, gitignored

/* ---------- fixtures ---------- */
function wav(seconds, freq, rate = 8000) {
  const n = Math.floor(seconds * rate), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const env = 0.25 + 0.75 * Math.abs(Math.sin((i / rate) * 1.7));
    b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 12000 * env), 44 + i * 2);
  }
  return b;
}
fs.mkdirSync(AUDIO, { recursive: true });
const fx = (name, sec, f) => { const p = path.join(AUDIO, name); if (!fs.existsSync(p)) fs.writeFileSync(p, wav(sec, f)); return p; };
const A_MIX = fx('A mix.wav', 20, 220);
const B_MIX = fx('B mix.wav', 20, 330);
const C_TWO = fx('C two.wav', 8, 440);
const D_THREE = fx('D three.wav', 8, 550);
const M_ONE = fx('M1 short.wav', 4, 260);
const M_TWO = fx('M2 short.wav', 4, 280);
const TAKES = Array.from({ length: 20 }, (_, i) => fx(`${i + 1} take.wav`, 6, 200 + i * 15));
const EXTRA = fx('21 extra.wav', 6, 600);

/* ---------- static server ---------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

/* ---------- page instrumentation ---------- */
const INIT = cfg => `(() => {
  const W = window, CFG = ${JSON.stringify(cfg)};
  W.__log = [];
  W.__vis = 'visible';
  Object.defineProperty(Document.prototype, 'visibilityState', { get(){ return W.__vis; }, configurable: true });
  Object.defineProperty(Document.prototype, 'hidden', { get(){ return W.__vis === 'hidden'; }, configurable: true });
  W.__setVis = v => { W.__vis = v; document.dispatchEvent(new Event('visibilitychange')); };

  /* mic route: play() rejects while a capture holds it (iOS behaviour) */
  W.__simulateRoute = !!CFG.simulateRoute; W.__routeLagMs = CFG.routeLagMs || 0;
  W.__routeHeld = false; W.__routeForever = false;
  W.__releaseRoute = () => {
    if (W.__routeForever) return;
    if (W.__routeLagMs > 0) setTimeout(() => { if (!W.__routeForever) { W.__routeHeld = false; W.__log.push('route.released'); } }, W.__routeLagMs);
    else W.__routeHeld = false;
  };
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    W.__log.push('play.attempt');
    if (W.__simulateRoute && W.__routeHeld) {
      W.__log.push('play.reject');
      return Promise.reject(new DOMException('capture holds the audio route', 'NotAllowedError'));
    }
    return origPlay.call(this);
  };

  /* SpeechRecognition stub */
  W.__sr = { starts: 0, aborts: 0, stops: 0, active: null };
  class FakeSR {
    constructor(){ this.onresult = null; this.onerror = null; this.onend = null; }
    start(){ W.__sr.starts++; W.__sr.active = this; W.__routeHeld = true; W.__log.push('sr.start'); }
    abort(){ W.__sr.aborts++; if (W.__sr.active === this) W.__sr.active = null; W.__log.push('sr.abort'); W.__releaseRoute(); }
    stop(){ W.__sr.stops++; if (W.__sr.active === this) W.__sr.active = null; W.__log.push('sr.stop'); W.__releaseRoute(); }
  }
  W.__say = text => {
    const s = W.__sr.active; if (!s || !s.onresult) return false;
    const r = [{ transcript: text }]; r.isFinal = false;
    s.onresult({ results: [r] }); return true;
  };
  if (CFG.noSR) { W.SpeechRecognition = undefined; W.webkitSpeechRecognition = undefined; }
  else { W.SpeechRecognition = FakeSR; W.webkitSpeechRecognition = FakeSR; }

  /* MediaSession spy */
  W.__ms = { handlers: {}, setCount: 0, positions: [], metaSets: 0, lastMeta: null };
  const ms = navigator.mediaSession;
  if (ms) {
    const oSet = ms.setActionHandler.bind(ms);
    ms.setActionHandler = (a, h) => { W.__ms.handlers[a] = h; W.__ms.setCount++; try { oSet(a, h); } catch (e) {} };
    const oPos = ms.setPositionState && ms.setPositionState.bind(ms);
    ms.setPositionState = s => { W.__ms.positions.push(s); try { oPos && oPos(s); } catch (e) {} };
    const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ms), 'metadata');
    Object.defineProperty(ms, 'metadata', { configurable: true,
      get(){ return d.get.call(ms); },
      set(v){ W.__ms.metaSets++;
        W.__ms.lastMeta = v ? { title: v.title, artist: v.artist, album: v.album,
          artwork: (v.artwork || []).map(a => ({ src: a.src, sizes: a.sizes, type: a.type })) } : null;
        d.set.call(ms, v); } });
  }

  /* wake lock, clipboard, prompt, decode + blob URL counters */
  W.__wake = { requests: 0 };
  const fakeWake = { request: async type => { W.__wake.requests++; const s = new EventTarget();
    s.released = false; s.type = type; s.release = async () => { if (!s.released) { s.released = true; s.dispatchEvent(new Event('release')); } };
    return s; } };
  Object.defineProperty(Navigator.prototype, 'wakeLock', { get(){ return fakeWake; }, configurable: true });
  W.__clip = [];
  Object.defineProperty(Navigator.prototype, 'clipboard', { get(){ return { writeText: async t => { W.__clip.push(t); } }; }, configurable: true });
  W.__promptAnswer = null; W.prompt = () => W.__promptAnswer;
  W.__decodes = 0;
  const oDec = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (...a) { W.__decodes++; return oDec.apply(this, a); };
  W.__urls = { created: 0, revoked: 0 };
  const oc = URL.createObjectURL, orv = URL.revokeObjectURL;
  URL.createObjectURL = o => { W.__urls.created++; return oc.call(URL, o); };
  URL.revokeObjectURL = u => { W.__urls.revoked++; return orv.call(URL, u); };
})();`;

/* ---------- harness ---------- */
const results = [];
let GROUP = '';
const check = (name, cond, detail) => {
  results.push({ group: GROUP, name, pass: !!cond, detail: cond ? undefined : detail });
  process.stdout.write(cond ? '.' : 'F');
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

async function open(cfg = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['microphone'], { origin: BASE.slice(0, -1) });
  await ctx.addInitScript({ content: INIT(cfg) });
  const page = await ctx.newPage();
  page.on('pageerror', e => { results.push({ group: GROUP, name: 'no uncaught page errors', pass: false, detail: e.message }); process.stdout.write('E'); });
  await page.goto(BASE + 'index.html');
  await page.waitForLoadState('load');
  return { ctx, page };
}
const ev = (page, expr) => page.evaluate(expr);
async function until(page, expr, timeout = 6000) {
  try { await page.waitForFunction(expr, null, { timeout, polling: 40 }); return true; } catch { return false; }
}
const ms = (page, action, arg) => page.evaluate(([a, x]) => { const h = window.__ms.handlers[a]; if (h) h(x || { action: a }); return !!h; }, [action, arg]);
async function loadFiles(page, files, input = '#fileInput') {
  await page.setInputFiles(input, files);
}
async function noteByText(page, text) {
  return page.evaluate(t => [...document.querySelectorAll('#noteList .note')].findIndex(r => (r.querySelector('.txt') || {}).textContent === t), text);
}
// Layout helper: the 1.0 session shows Notes and Queue as tabs. Open the
// one a check is about to touch; on layouts without tabs this does nothing.
const showTab = (page, t) => page.evaluate(t => { const b = document.querySelector(`.tab[data-tab="${t}"]`);
  if (b && getComputedStyle(b).display !== 'none' && b.getAttribute('aria-selected') !== 'true') b.click(); }, t);
const isOn = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return !!e && e.classList.contains('on'); }, sel);
const shown = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }, sel);

/* ================= CORE: pause-to-talk ================= */
async function core() {
  GROUP = 'core';
  const { ctx, page } = await open();
  check('boot shows landing, hides session', await shown(page, '#emptyState') && !(await shown(page, '#session')));
  await loadFiles(page, [A_MIX]);
  check('loading a track enters the session', await until(page, "qIndex===0 && document.body.classList.contains('in-session')") && await shown(page, '#session'));
  check('track name shown', (await ev(page, "$('trackName').textContent")) === 'A mix.wav');
  check('duration loads', await until(page, 'dur>19'), await ev(page, 'dur'));
  await page.click('#playBtn');
  check('on-screen play starts playback', await until(page, 'isPlaying() && hasPlayedOnce'));
  await until(page, 'curTime()>4.6');
  const t0 = await ev(page, 'curTime()');
  await ms(page, 'pause');
  check('headphone pause opens listening', await until(page, "listenState==='listening'") && await isOn(page, '#listenOverlay'));
  const pin = await ev(page, 'pinTs');
  check('pin lands 3s back', Math.abs(pin - (t0 - 3)) < 0.6, { pin, t0 });
  check('speech recognition started', await ev(page, '__sr.starts===1 && !!__sr.active'));
  await ev(page, "__say('kick is too loud')");
  check('live transcript shows', (await ev(page, "$('loTranscript').textContent")) === 'kick is too loud');
  await ms(page, 'play');
  check('headphone play resumes', await until(page, 'isPlaying()'));
  check('overlay closes, state idle, mic released',
    await ev(page, "listenState==='idle' && !$('listenOverlay').classList.contains('on') && __sr.aborts>=1 && !__sr.active"));
  check('note saved at the pin with the transcript',
    await ev(page, `notes.length===1 && notes[0].text==='kick is too loud' && Math.abs(notes[0].t-${pin})<0.01`));
  check('note persisted under the track key',
    await ev(page, "JSON.parse(localStorage.getItem(trackKey('A mix.wav'))).notes.length===1"));

  await sleep(400);
  await ms(page, 'pause'); await until(page, "listenState==='listening'");
  await ms(page, 'play'); await until(page, 'isPlaying()');
  check('silence saves nothing', await ev(page, 'notes.length===1'));

  const starts = await ev(page, '__sr.starts');
  await page.click('#playBtn');
  check('on-screen pause is quiet (no mic, no overlay)',
    await until(page, '!isPlaying()') && (await sleep(250), await ev(page, `listenState==='idle' && __sr.starts===${starts} && !$('listenOverlay').classList.contains('on')`)));

  await page.click('#noteBtn');
  check('Drop a note while paused opens listening', await until(page, "listenState==='listening'"));
  check('no keyboard in capture', await ev(page, `(() => {
    const a = document.activeElement;
    const editable = a && (a.tagName==='INPUT'&&a.type!=='file' || a.tagName==='TEXTAREA' || a.isContentEditable);
    const inOverlay = $('listenOverlay').querySelector('input,textarea,[contenteditable]');
    return !editable && !inOverlay;
  })()`));
  await ev(page, "__say('snare too dry')");
  await page.click('#loSave');
  check('overlay save button resumes and saves', await until(page, 'isPlaying() && notes.length===2'));

  await until(page, 'curTime()>9');
  await page.click('#noteBtn');
  check('Drop a note while playing pauses into listening', await until(page, "listenState==='listening' && !isPlaying()"));
  await ms(page, 'play'); await until(page, 'isPlaying()');

  const starts2 = await ev(page, '__sr.starts');
  await ev(page, "__setVis('hidden')");
  await ms(page, 'pause');
  check('backgrounded pause saves a flagged bookmark, no mic',
    await until(page, "!isPlaying() && notes.some(n=>n.flagged)") &&
    await ev(page, `listenState==='idle' && __sr.starts===${starts2} && notes.find(n=>n.flagged).tags.includes('Flagged')`));
  const flagT = await ev(page, 'notes.find(n=>n.flagged).t');
  await ev(page, "__setVis('visible')");
  check('returning visible auto-opens the flag fill',
    await until(page, "listenState==='listening'") && await ev(page, `!!fillingFlagId && pinTs===${flagT}`));
  await ev(page, "__say('hihat harsh')");
  await ms(page, 'play');
  check('speaking fills the flag', await until(page, "isPlaying() && notes.some(n=>n.text==='hihat harsh')") &&
    await ev(page, "(n=>!n.flagged && !n.tags.includes('Flagged'))(notes.find(n=>n.text==='hihat harsh'))"));

  await ev(page, "__setVis('hidden')"); await ms(page, 'pause');
  await until(page, '!isPlaying() && notes.some(n=>n.flagged)');
  await ev(page, 'notes.find(n=>n.flagged).flaggedAt=Date.now()-11*60*1000');
  await ev(page, "__setVis('visible')"); await sleep(300);
  check('stale flag (>10 min) is not auto-filled', await ev(page, "listenState==='idle'"));

  await ev(page, 'seek(5)'); await sleep(100);
  await ev(page, "__promptAnswer='Chorus'");
  await page.click('#markerBtn');
  check('section marker saved', await ev(page, "markers.some(m=>m.name==='Chorus' && Math.abs(m.t-5)<0.2)"));
  await ev(page, 'seek(8)'); await page.click('#playBtn'); await until(page, 'isPlaying() && curTime()>8.4');
  await ms(page, 'pause'); await until(page, "listenState==='listening'");
  await ev(page, "__say('vocal sibilance')"); await ms(page, 'play');
  check('note after a marker carries its section', await until(page, "notes.some(n=>n.text==='vocal sibilance' && n.section==='Chorus')"));

  let i = await noteByText(page, 'kick is too loud');
  await page.locator('#noteList .note').nth(i).locator('.checkBtn').click();
  check('done toggle persists', await ev(page, "notes.find(n=>n.text==='kick is too loud').done===true && JSON.parse(localStorage.getItem(trackKey('A mix.wav'))).notes.find(n=>n.text==='kick is too loud').done===true"));

  i = await noteByText(page, 'snare too dry');
  const tBefore = await ev(page, "notes.find(n=>n.text==='snare too dry').t");
  await page.locator('#noteList .note').nth(i).locator('.txt').click();
  check('tapping a note row opens the edit sheet', await shown(page, '#sheet'));
  await page.click('#tsPlus');
  await page.fill('#noteText', 'snare edited');
  await page.click('#saveNote');
  check('edit saves text and nudged time', await ev(page, `(n=>!!n && Math.abs(n.t-${tBefore}-1)<0.01)(notes.find(n=>n.text==='snare edited'))`) && !(await shown(page, '#sheet')));

  const before = await ev(page, 'notes.length');
  i = await noteByText(page, 'snare edited');
  await page.locator('#noteList .note').nth(i).locator('.txt').click();
  await page.click('#deleteNote');
  check('delete from the sheet removes and persists', await ev(page, `notes.length===${before - 1} && JSON.parse(localStorage.getItem(trackKey('A mix.wav'))).notes.length===${before - 1}`));

  await page.click('#exportBtn');
  check('export copies track, timecode and text', await until(page, "__clip.length>0 && __clip.at(-1).includes('A mix.wav') && __clip.at(-1).includes('kick is too loud') && /\\d:\\d\\d/.test(__clip.at(-1))"));

  for (let k = 0; k < 3; k++) await page.click('.timecode');
  check('triple tap opens diagnostics with the log', await isOn(page, '#dbgOverlay') && (await ev(page, "$('dbgLog').textContent")).includes('MS action: pause'));
  await page.click('#dbgClose');
  check('diagnostics close', !(await isOn(page, '#dbgOverlay')));
  check('diagnostics tail persisted', await ev(page, "(localStorage.getItem('noted:debuglog')||'').includes('MS action')"));
  check('wake lock requested on play, badge on', await ev(page, "__wake.requests>0 && $('wakeBadge').classList.contains('on')"));

  const count = await ev(page, 'notes.length');
  await ev(page, "localStorage.setItem('mixride:legacy_track', JSON.stringify({notes:[{id:'x',t:1,text:'old'}],markers:[]}))");
  await page.reload(); await page.waitForLoadState('load');
  check('reload restores the queue and notes from storage', await until(page, `qIndex===0 && notes.length===${count}`, 8000), await ev(page, 'notes.length'));
  check('diagnostics keep the previous session', await ev(page, "dbgLines.some(l=>l.includes('previous session'))"));
  check('legacy mixride: keys migrate', await ev(page, "localStorage.getItem('noted:legacy_track')!==null && localStorage.getItem('mixride:legacy_track')===null"));
  await ctx.close();
}

/* ================= MEMO fallback (no SpeechRecognition) ================= */
async function memo() {
  GROUP = 'memo';
  const { ctx, page } = await open({ noSR: true });
  await loadFiles(page, [A_MIX]);
  await until(page, 'dur>19');
  await page.click('#playBtn'); await until(page, 'isPlaying() && curTime()>3.5');
  await ms(page, 'pause');
  check('no SR: pause records a voice memo', await until(page, "listenState==='listening' && usingMemo && memoRec && memoRec.state==='recording'"));
  await sleep(700);
  await ms(page, 'play');
  check('play saves the memo note and resumes', await until(page, 'isPlaying() && notes.length===1 && notes[0].hasMemo===true', 8000));
  check('memo blob stored in IndexedDB', await page.evaluate(async () => { const r = await idbGetMemo(notes[0].id); return !!(r && r.blob && r.blob.size > 0); }));
  check('memo row has a play button', await ev(page, "!!document.querySelector('#noteList .memoBtn')"));

  await loadFiles(page, [M_ONE, M_TWO]);
  await until(page, "queue.length===2 && qIndex===0 && dur>3");
  await page.click('#playBtn'); await until(page, 'isPlaying()');
  await ev(page, 'seek(dur-1.3)'); await sleep(150);
  await ev(page, 'beginListening()');
  await until(page, "memoRec && memoRec.state==='recording'");
  check('memo saved after auto-advance lands on the track it was taken on',
    await until(page, "qIndex===1 && notesFor(queue[0].key).notes.some(n=>n.hasMemo) && !notesFor(queue[1].key).notes.some(n=>n.hasMemo)", 8000));
  await ctx.close();
}

/* ================= MEDIASESSION ================= */
async function mediasession() {
  GROUP = 'mediasession';
  const { ctx, page } = await open();
  await loadFiles(page, [B_MIX]); await until(page, 'qIndex===0 && dur>19');
  check('single track: play/pause/seek handlers set, skips cleared',
    await ev(page, "['play','pause','seekbackward','seekforward'].every(a=>typeof __ms.handlers[a]==='function') && !__ms.handlers.nexttrack && !__ms.handlers.previoustrack"));
  check('metadata: title, artist, empty album', await ev(page, "__ms.lastMeta.title==='B mix.wav' && __ms.lastMeta.artist==='noted 1.0' && __ms.lastMeta.album===''"));
  check('artwork set runs 96 to 2048, PNG, largest last', await ev(page, "(a=>a.length===8 && a[0].sizes==='96x96' && a.at(-1).sizes==='2048x2048' && a.every(x=>x.type==='image/png' && /\\/art\\/artwork-\\d+\\.png$/.test(x.src)))(__ms.lastMeta.artwork)"));
  check('every artwork file is a real PNG at its stated size', await page.evaluate(async () => {
    for (const a of __ms.lastMeta.artwork) {
      const n = +a.sizes.split('x')[0]; const r = await fetch(a.src); if (!r.ok) return false;
      const b = new DataView(await r.arrayBuffer());
      if (b.getUint32(0) !== 0x89504e47 || b.getUint32(16) !== n || b.getUint32(20) !== n) return false;
    } return true; }));
  await page.click('#playBtn'); await until(page, 'isPlaying()');
  check('playbackState playing', await until(page, "navigator.mediaSession.playbackState==='playing'"));
  check('position state carries the duration', await ev(page, '__ms.positions.some(p=>Math.abs(p.duration-dur)<0.01)'));
  await until(page, 'curTime()>2');
  let t = await ev(page, 'curTime()');
  await ms(page, 'seekforward', { action: 'seekforward', seekOffset: 10 });
  check('seekforward jumps ahead', Math.abs((await ev(page, 'curTime()')) - (t + 10)) < 0.6);
  t = await ev(page, 'curTime()');
  await ms(page, 'seekbackward', { action: 'seekbackward', seekOffset: 10 });
  check('seekbackward jumps back', Math.abs((await ev(page, 'curTime()')) - (t - 10)) < 0.6);
  await page.click('.rateChip[data-rate="1.25"]');
  check('rate change feeds position state', await ev(page, '__ms.positions.at(-1).playbackRate===1.25 && audioEl.playbackRate===1.25'));
  await page.click('.rateChip[data-rate="1"]');
  await ev(page, 'seek(3)');
  check('seek feeds position state', await ev(page, 'Math.abs(__ms.positions.at(-1).position-3)<0.3'));

  let sc = await ev(page, '__ms.setCount'), mc = await ev(page, '__ms.metaSets');
  await page.click('#playBtn'); await until(page, '!isPlaying()');
  await page.click('#playBtn'); await until(page, 'isPlaying()');
  check('every play re-asserts handlers and metadata', await until(page, `__ms.setCount>=${sc + 6} && __ms.metaSets>${mc}`, 3000));
  sc = await ev(page, '__ms.setCount');
  await ms(page, 'pause'); await until(page, "listenState==='listening'");
  check('listening re-asserts the session, state paused', await ev(page, `__ms.setCount>${sc} && navigator.mediaSession.playbackState==='paused'`));
  await ms(page, 'play'); await until(page, 'isPlaying()');

  await loadFiles(page, [C_TWO, D_THREE], '#fileInput2');
  check('adding tracks arms skips and drops seek handlers',
    await until(page, "queue.length===3 && typeof __ms.handlers.nexttrack==='function' && typeof __ms.handlers.previoustrack==='function' && !__ms.handlers.seekbackward && !__ms.handlers.seekforward"));
  check('album shows queue position', await ev(page, "__ms.lastMeta.album==='1 / 3'"));
  await ms(page, 'nexttrack');
  check('nexttrack advances, keeps playing, updates the card',
    await until(page, "qIndex===1 && isPlaying() && __ms.lastMeta.title==='C two.wav' && __ms.lastMeta.album==='2 / 3'"));

  const flagCount = () => ev(page, 'Object.values(notesByTrack).reduce((s,d)=>s+d.notes.filter(n=>n.flagged).length,0)');
  const f0 = await flagCount();
  await ev(page, "__setVis('hidden')");
  await ms(page, 'nexttrack');
  check('locked skip changes track without a flag', await until(page, 'qIndex===2 && isPlaying()') && (await sleep(200), (await flagCount()) === f0));
  const s0 = await ev(page, '__sr.starts');
  await ms(page, 'pause');
  check('locked pause bookmarks without the mic', await until(page, '!isPlaying()') && (await sleep(150), (await flagCount()) === f0 + 1) && (await ev(page, '__sr.starts')) === s0);
  await ev(page, "__setVis('visible')");
  check('unlock opens the flag fill', await until(page, "listenState==='listening' && !!fillingFlagId"));
  await ms(page, 'play'); await until(page, 'isPlaying()');
  check('silent flag fill keeps the flag', (await flagCount()) === f0 + 1);
  await sleep(300);
  await ms(page, 'pause');
  check('foreground pause opens listening', await until(page, "listenState==='listening'"));
  await ms(page, 'play'); await until(page, 'isPlaying() && curTime()>3.3');
  await ms(page, 'previoustrack');
  check('previoustrack past 3s restarts the track', await until(page, 'qIndex===2 && curTime()<1.2'));
  await ms(page, 'previoustrack');
  check('previoustrack within 3s goes back a track', await until(page, 'qIndex===1'));
  await page.evaluate(() => removeTrack(2)); await page.evaluate(() => removeTrack(0));
  check('back to one track restores seek handlers, clears skips',
    await until(page, "queue.length===1 && typeof __ms.handlers.seekforward==='function' && !__ms.handlers.nexttrack"));
  await until(page, 'dur>0');
  if (await ev(page, 'isPlaying()')) { await page.click('#playBtn'); await until(page, '!isPlaying()'); }
  await ms(page, 'play');
  check('MS play from idle pause starts playback', await until(page, 'isPlaying()'));
  await ctx.close();
}

/* ================= QUEUE ================= */
async function queueSuite() {
  GROUP = 'queue';
  const { ctx, page } = await open();
  const shuffled = [...TAKES].sort((a, b) => (a.length * 7 + b.charCodeAt(a.length - 6)) % 3 - 1);
  await loadFiles(page, shuffled);
  check('20 tracks queue', await until(page, 'queue.length===20 && qIndex===0 && dur>5'));
  check('numeric-aware order', await ev(page, "queue[1].name==='2 take.wav' && queue[9].name==='10 take.wav'"));
  check('queue list renders with position', await ev(page, "document.querySelectorAll('#queueList .qItem').length===20 && $('queueCount').textContent.includes('20')"));
  check('transport shows skips for a queue', await ev(page, "$('transport').classList.contains('multi') && $('nextBtn').offsetParent!==null"));
  await page.click('#nextBtn');
  check('on-screen next while paused stays paused', await until(page, 'qIndex===1') && !(await ev(page, 'isPlaying()')));
  await page.click('#playBtn'); await until(page, 'isPlaying()');
  await page.click('#nextBtn');
  check('on-screen next while playing keeps playing', await until(page, 'qIndex===2 && isPlaying()'));
  await sleep(900);
  const d0 = await ev(page, '__decodes');
  await ev(page, 'for(let i=0;i<8;i++) __ms.handlers.nexttrack()');
  check('rapid skips land on the right track', await until(page, 'qIndex===10 && isPlaying()'));
  // superseded requests each wait out their 200ms debounce in sequence
  check('settled track peaks cached', await until(page, 'peaksCache.has(queue[10].key)', 6000));
  const d1 = await ev(page, '__decodes');
  check('rapid skips decode only the settled track', d1 - d0 <= 2, { d0, d1 });
  const d2 = await ev(page, '__decodes');
  await showTab(page, 'queue');
  await page.locator('#queueList .qItem').nth(2).click();
  await until(page, 'qIndex===2'); await sleep(600);
  check('revisiting a decoded track decodes nothing', (await ev(page, '__decodes')) === d2);
  const rv = await ev(page, '__urls.revoked');
  await page.locator('#queueList .qItem').nth(10).click();
  check('track switch revokes the old blob URL', await until(page, `qIndex===10 && __urls.revoked>${rv}`));
  await until(page, 'isPlaying() && curTime()>4.4');
  await ms(page, 'pause'); await until(page, "listenState==='listening'");
  await ev(page, "__say('bass muddy')");
  await ms(page, 'nexttrack');
  check('skip while listening commits to the original track',
    await until(page, "qIndex===11 && notesFor(queue[10].key).notes.some(n=>n.text==='bass muddy') && !notes.some(n=>n.text==='bass muddy')"));
  check('skip while listening closes the mic', await ev(page, "listenState==='idle' && !__sr.active"));
  await until(page, 'isPlaying() && dur>5');
  await ev(page, 'seek(dur-0.9)'); await sleep(120);
  await ev(page, 'beginListening()'); await ev(page, "__say('tail end')");
  check('track end while listening commits, then advances',
    await until(page, "qIndex===12 && isPlaying() && notesFor(queue[11].key).notes.some(n=>n.text==='tail end')", 6000));
  await until(page, 'dur>5'); await ev(page, 'seek(dur-0.5)');
  check('auto-advance at track end keeps playing', await until(page, 'qIndex===13 && isPlaying()', 6000));
  await ev(page, 'loadTrack(19,{autoplay:true})'); await until(page, 'qIndex===19 && isPlaying() && dur>5');
  await ev(page, 'seek(dur-0.4)');
  check('last track end finishes the queue', await until(page, "!isPlaying() && qIndex===19 && navigator.mediaSession.playbackState==='none'", 6000));
  check('queue position persisted', await ev(page, "JSON.parse(localStorage.getItem('noted:queue')).index===19 && JSON.parse(localStorage.getItem('noted:queue')).tracks.length===20"));

  await page.reload(); await page.waitForLoadState('load');
  check('reload restores all 20 tracks and the position', await until(page, 'queue.length===20 && qIndex===19 && queue.every(t=>t.file && !t.missing)', 12000));
  check('notes group by track', await ev(page, "document.querySelectorAll('#noteList .trackGroup').length===2"));
  const tNote = await ev(page, "notesFor(queue[10].key).notes.find(n=>n.text==='bass muddy').t");
  await showTab(page, 'notes');
  const iRow = await noteByText(page, 'bass muddy');
  await page.locator('#noteList .note').nth(iRow).locator('.ts').click();
  check('tapping a note on another track switches and seeks after metadata',
    await until(page, `qIndex===10 && pendingSeek===null && dur>5 && curTime()>=${Math.max(0, tNote - 1) - 0.05} && curTime()<${Math.max(0, tNote - 1) + 1.2}`), { tNote, now: await ev(page, 'curTime()') });
  const name10 = await ev(page, 'queue[10].name');
  await showTab(page, 'queue');
  await page.locator('#queueList .qItem').nth(3).locator('.qDel').click();
  check('removing an earlier track keeps the current one', await until(page, `queue.length===19 && qIndex===9 && queue[9].name===${JSON.stringify(name10)}`));
  await page.locator('#queueList .qItem.on .qDel').click();
  check('removing the current track loads its neighbour', await until(page, `queue.length===18 && qIndex===9 && queue[9].name!==${JSON.stringify(name10)} && fileName===queue[9].name`));
  await loadFiles(page, [TAKES[0]], '#fileInput2');
  await sleep(300);
  check('adding a duplicate file does not duplicate', await ev(page, 'queue.length===18'));
  await loadFiles(page, [EXTRA], '#fileInput2');
  check('adding a new file appends it', await until(page, "queue.length===19 && queue[18].name==='21 extra.wav'"));
  await ev(page, 'loadTrack(15,{autoplay:false})'); await until(page, 'qIndex===15');
  check('queue scrolls the current row into view', await ev(page, "$('queueList').scrollHeight<= $('queueList').clientHeight || $('queueList').scrollTop>0"));
  check('queue rows stay inside their own scroll box', await ev(page, "$('queueList').scrollHeight>$('queueList').clientHeight"));
  await page.evaluate(() => { while (queue.length) removeTrack(0); });
  check('removing every track returns to the landing', await until(page, "!document.body.classList.contains('in-session') && getComputedStyle($('emptyState')).display!=='none' && getComputedStyle($('session')).display==='none'"));
  await ctx.close();
}

/* ================= RESUME DEADLOCK (mic holds the route) ================= */
async function deadlock() {
  GROUP = 'deadlock';
  const { ctx, page } = await open({ simulateRoute: true, routeLagMs: 400 });
  await loadFiles(page, [A_MIX]); await until(page, 'dur>19');
  await page.click('#playBtn'); await until(page, 'isPlaying() && curTime()>3.5');
  await ms(page, 'pause'); await until(page, "listenState==='listening'");
  check('listening holds the route', await ev(page, '__routeHeld===true'));
  await ev(page, "__say('too much reverb'); __log.length=0; dbgLines.length=0");
  await ms(page, 'play');
  check('mic released before the first play attempt', await ev(page, "__log.indexOf('sr.abort')>-1 && __log.indexOf('sr.abort')<__log.indexOf('play.attempt')"));
  check('note committed before playback resumes', await ev(page, "notes.some(n=>n.text==='too much reverb')"));
  check('play() rejected while the route was held', await ev(page, "__log.includes('play.reject')"));
  check('resume completes on retry', await until(page, 'isPlaying()', 2500));
  check('rejections logged to diagnostics', await ev(page, "dbgLines.some(l=>l.includes('play() rejected'))"));
  const okLine = await ev(page, "dbgLines.find(l=>l.includes('play OK on attempt'))||''");
  const n = +((okLine.match(/attempt (\d)/) || [])[1] || 0);
  check('success logged on a later attempt (2 to 4)', n >= 2 && n <= 4, okLine);
  await sleep(300);
  await ms(page, 'pause'); await until(page, "listenState==='listening'");
  await ev(page, "__say('second pass')"); await ms(page, 'play');
  check('second cycle resumes clean', await until(page, "isPlaying() && notes.some(n=>n.text==='second pass')", 2500));

  await sleep(300);
  await ms(page, 'pause'); await until(page, "listenState==='listening'");
  await ev(page, '__log.length=0');
  await ms(page, 'play'); await ms(page, 'pause');
  await sleep(1600);
  check('a newer pause cancels pending retries', await ev(page, "!isPlaying() && __log.filter(x=>x==='play.attempt').length===1"));
  await page.click('#playBtn'); await until(page, 'isPlaying()');

  await sleep(300);
  await ms(page, 'pause'); await until(page, "listenState==='listening'");
  await ev(page, '__routeForever=true; __log.length=0');
  await ms(page, 'play');
  await sleep(1700);
  check('gives up after 4 attempts with a tap-to-resume toast',
    await ev(page, "!isPlaying() && __log.filter(x=>x==='play.reject').length===4 && $('toast').style.display==='block'"));
  await ev(page, '__routeForever=false; __routeHeld=false');
  await page.click('#playBtn'); await until(page, 'isPlaying()');

  await sleep(300);
  await ms(page, 'pause'); await until(page, "listenState==='listening'");
  await ev(page, '__log.length=0');
  await page.click('#loSave');
  check('save button also releases the mic first', await ev(page, "__log.indexOf('sr.abort')>-1 && __log.indexOf('sr.abort')<__log.indexOf('play.attempt')") && await until(page, 'isPlaying()', 2500));

  await sleep(300);
  await ms(page, 'pause'); await until(page, "listenState==='listening'");
  await ev(page, "__say('fenced'); window.__rn=renderNotes; renderNotes=function(){ renderNotes=window.__rn; throw new Error('boom'); }");
  await ms(page, 'play');
  check('a throw in the save path never blocks resume', await until(page, 'isPlaying()', 2500) && await ev(page, "dbgLines.some(l=>l.includes('note save threw'))"));
  await ev(page, 'renderNotes=window.__rn; renderNotes()');
  check('recognition is aborted, never stopped', await ev(page, '__sr.stops===0 && __sr.aborts>=5'));
  check('diagnostics record the cycle', await ev(page, "['MS action: play','listening: begin','SR released','resume [headphones]'].every(s=>dbgLines.some(l=>l.includes(s)))"));
  const c = await ev(page, 'notes.length');
  await sleep(300);
  await ms(page, 'pause'); await until(page, "listenState==='listening'");
  await ms(page, 'play');
  check('silence under route lag saves nothing and resumes', await until(page, 'isPlaying()', 2500) && (await ev(page, 'notes.length')) === c);
  await ctx.close();
}

const SUITES = { core, memo, mediasession, queue: queueSuite, deadlock };
for (const [k, fn] of Object.entries(SUITES)) {
  if (ONLY && !ONLY.includes(k)) continue;
  process.stdout.write(`\n${k}: `);
  try { await fn(); } catch (e) { results.push({ group: k, name: 'suite ran to completion', pass: false, detail: String(e && e.stack || e).slice(0, 600) }); process.stdout.write('X'); }
}
await browser.close(); server.close();
const fails = results.filter(r => !r.pass);
const by = {};
for (const r of results) { by[r.group] ??= [0, 0]; by[r.group][r.pass ? 0 : 1]++; }
console.log('\n');
for (const [g, [p, f]] of Object.entries(by)) console.log(`${g.padEnd(13)} ${p} passed${f ? `, ${f} FAILED` : ''}`);
console.log(`TOTAL ${results.length - fails.length}/${results.length} passed`);
for (const f of fails) console.log(`FAIL [${f.group}] ${f.name}${f.detail !== undefined ? ' :: ' + JSON.stringify(f.detail) : ''}`);
process.exit(fails.length ? 1 : 0);
