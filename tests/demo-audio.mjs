// Song-shaped demo bounces (sections, beats, fills) so the waveform reads like music.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
// usage (from tests/): node demo-audio.mjs [out dir, default: .tools/demo]
const OUT = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../.tools/demo'));
fs.mkdirSync(OUT, { recursive: true });
function song(name, sections, seed) {
  const rate = 8000; let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const total = sections.reduce((a, x) => a + x[0], 0), n = Math.floor(total * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  let i = 0, beatAmp = [];
  for (const [dur, level, busy] of sections) {
    const m = Math.floor(dur * rate);
    for (let k = 0; k < m; k++, i++) {
      const t = i / rate, beat = Math.floor(t * 2), ph = t * 2 - beat;
      if (!beatAmp[beat]) beatAmp[beat] = 0.6 + 0.4 * rnd();
      const kick = Math.exp(-ph * 7) * beatAmp[beat] * busy;
      const pad = 0.35 + 0.15 * Math.sin(t * 0.7);
      const v = (Math.sin(2 * Math.PI * 110 * t) * pad + (rnd() * 2 - 1) * kick) * level;
      b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 26000))), 44 + i * 2);
    }
  }
  fs.writeFileSync(path.join(OUT, name), b);
}
// [seconds, level, beat density]
song('01 ride home v3.wav', [[12,.18,.2],[36,.5,.8],[32,.85,1],[16,.25,.3],[44,.9,1],[30,.55,.7],[52,.45,.5]], 7);
song('02 chorus rework.wav', [[8,.2,.3],[40,.55,.8],[40,.9,1],[20,.35,.4],[60,.85,1],[28,.4,.5]], 11);
song('03 night drive.wav', [[20,.25,.3],[60,.6,.9],[30,.3,.3],[70,.8,1],[34,.4,.4]], 23);
song('04 outro idea.wav', [[10,.2,.2],[50,.65,.9],[40,.4,.5],[30,.2,.2]], 31);
console.log(fs.readdirSync(OUT).join('\n'));
