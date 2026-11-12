import { encodeWav } from './wav.js';
import { renderMix } from '../sequencer/renderer.js';
import { app } from '../app.js';
import { resampleBuf } from '../audio/edit.js';

let lameP = null;
function loadLame() {
  if (typeof lamejs !== 'undefined' && lamejs.Mp3Encoder) return Promise.resolve();
  if (lameP) return lameP;
  lameP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = new URL('../vendor/lame.min.js', import.meta.url).href; s.onload = () => (typeof lamejs !== 'undefined' && lamejs.Mp3Encoder ? res() : rej(new Error('MP3エンコーダーの初期化に失敗'))); s.onerror = () => rej(new Error('MP3エンコーダーを読み込めませんでした')); document.head.append(s); });
  lameP.catch(() => { lameP = null; });
  return lameP;
}
export async function encodeMp3(L, R, sr, kbps, onProgress) {
  await loadLame(); const enc = new lamejs.Mp3Encoder(2, sr, kbps), out = [], N = 1152 * 8, toI = (a, s, e) => { const o = new Int16Array(e - s); for (let i = s; i < e; i++) { const v = Math.max(-1, Math.min(1, a[i])); o[i - s] = v < 0 ? v * 32768 : v * 32767; } return o; };
  for (let p = 0; p < L.length; p += N) { const e = Math.min(L.length, p + N), b = enc.encodeBuffer(toI(L, p, e), toI(R, p, e)); if (b.length) out.push(new Uint8Array(b)); if ((p / N) % 40 === 0) { onProgress && onProgress(p / L.length); await new Promise((r) => setTimeout(r)); } }
  const f = enc.flush(); if (f.length) out.push(new Uint8Array(f)); return new Blob(out, { type: 'audio/mpeg' });
}
function normalizeInPlace(L, R, db) { let p = 0; for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i])); if (p < 1e-6) return; const g = Math.pow(10, db / 20) / p; for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; } }
// opts: {scope:'master'|'tracks'|'selection'|'loop', format, sr, bits, kbps, normalize, normDb, trackIds, range:{start,end}}
export async function exportAudio(opts, onProgress) {
  const P = JSON.parse(JSON.stringify(app.project)), jobs = []; let range = {};
  if (opts.scope === 'selection' && opts.range) range = { start: opts.range.start, end: opts.range.end };
  else if (opts.scope === 'loop') range = { start: P.loop.start, end: P.loop.end };
  const base = (P.name || 'voice-daw').replace(/[\\/:*?"<>|]/g, '_');
  if (opts.scope === 'tracks') for (const t of P.tracks) jobs.push({ name: base + '_' + t.name.replace(/[\\/:*?"<>|]/g, '_'), tracks: [t.id] }); else jobs.push({ name: base, tracks: null });
  const results = [];
  for (let j = 0; j < jobs.length; j++) {
    const jb = jobs[j], span = 1 / jobs.length, prog = (p, ph = 0) => onProgress && onProgress((j + ph * 0.5 + p * 0.5) * span);
    const r = await renderMix(P, { sr: opts.sr, ...range, tracks: jb.tracks || undefined, ignoreMuteSolo: opts.scope === 'tracks', tail: 2, onProgress: (p) => prog(p, 0) });
    const L = r.L, R = r.R; if (opts.normalize) normalizeInPlace(L, R, opts.normDb ?? -1);
    let blob, ext = opts.format, note = '';
    if (opts.format === 'wav') blob = encodeWav([L, R], opts.sr, opts.bits || 16);
    else blob = await encodeMp3(L, R, opts.sr, opts.kbps || 192, (p) => prog(p, 1));
    results.push({ name: jb.name + '.' + ext, blob, note });
  }
  return results;
}
// 素材単体の書き出し
export function exportAssetWav(buf, bits = 16) { return encodeWav(buf.ch.length === 1 ? [buf.ch[0], buf.ch[0]] : buf.ch, buf.sr, bits); }
export { resampleBuf };
