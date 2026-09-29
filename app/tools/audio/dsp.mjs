// A tiny offline synth: oscillators, noise, RBJ biquads, envelopes, a Freeverb-style reverb, MP3/WAV out.
import fs from 'fs';
import { Mp3Encoder } from '@breezystack/lamejs';

export const SR = 32000;
export const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
export const len = (b) => b.length / SR;

let seed = 1234567;
export const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
export const noise = () => rnd() * 2 - 1;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
/** 'D3' → Hz */
export const hz = (n) => { const m = /^([A-G][#b]?)(-?\d)$/.exec(n); return mtof(12 * (+m[2] + 1) + NOTE[m[1]]); };

/** Phase-accumulating oscillator; f may be a number or a function of time. */
export function osc(type, f, sec, amp = 1, out = buf(sec), at = 0) {
  let ph = rnd();
  const n = Math.ceil(sec * SR), o = Math.floor(at * SR);
  for (let i = 0; i < n && o + i < out.length; i++) {
    const t = i / SR; const fr = typeof f === 'function' ? f(t) : f;
    ph += fr / SR; ph -= Math.floor(ph);
    let v;
    switch (type) {
      case 'sine': v = Math.sin(2 * Math.PI * ph); break;
      case 'saw': v = 2 * ph - 1; break;
      case 'square': v = ph < 0.5 ? 1 : -1; break;
      case 'tri': v = 1 - 4 * Math.abs(ph - 0.5); break;
    }
    out[o + i] += v * (typeof amp === 'function' ? amp(t) : amp);
  }
  return out;
}

export function noiseInto(sec, amp = 1, out = buf(sec), at = 0) {
  const n = Math.ceil(sec * SR), o = Math.floor(at * SR);
  for (let i = 0; i < n && o + i < out.length; i++) out[o + i] += noise() * (typeof amp === 'function' ? amp(i / SR) : amp);
  return out;
}

/** RBJ biquad over a buffer in place; cutoff/q may be functions of time (recomputed every 16 samples). */
export function biquad(b, type, fc, q = 0.707, gainDb = 0) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0, b1, b2, a1, a2;
  const coef = (f, Q) => {
    f = Math.min(Math.max(f, 10), SR * 0.45);
    const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q), A = Math.pow(10, gainDb / 40);
    let B0, B1, B2, A0, A1, A2;
    if (type === 'lp') { B0 = (1 - c) / 2; B1 = 1 - c; B2 = (1 - c) / 2; A0 = 1 + al; A1 = -2 * c; A2 = 1 - al; }
    else if (type === 'hp') { B0 = (1 + c) / 2; B1 = -(1 + c); B2 = (1 + c) / 2; A0 = 1 + al; A1 = -2 * c; A2 = 1 - al; }
    else if (type === 'bp') { B0 = al; B1 = 0; B2 = -al; A0 = 1 + al; A1 = -2 * c; A2 = 1 - al; }
    else if (type === 'peak') { B0 = 1 + al * A; B1 = -2 * c; B2 = 1 - al * A; A0 = 1 + al / A; A1 = -2 * c; A2 = 1 - al / A; }
    b0 = B0 / A0; b1 = B1 / A0; b2 = B2 / A0; a1 = A1 / A0; a2 = A2 / A0;
  };
  for (let i = 0; i < b.length; i++) {
    if (i % 16 === 0) coef(typeof fc === 'function' ? fc(i / SR) : fc, typeof q === 'function' ? q(i / SR) : q);
    const x = b[i]; const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y; b[i] = y;
  }
  return b;
}

/** Multiply by an envelope function of time. */
export function env(b, f) { for (let i = 0; i < b.length; i++) b[i] *= f(i / SR); return b; }
export const expDecay = (d, a = 0.002) => (t) => (t < a ? t / a : Math.exp(-(t - a) / d));
export const adsr = (a, d, s, r, hold) => (t) => t < a ? t / a : t < a + d ? 1 - (1 - s) * (t - a) / d : t < a + d + hold ? s : Math.max(0, s * (1 - (t - a - d - hold) / r));
export const bell = (dur) => (t) => (t < 0 || t > dur ? 0 : Math.sin(Math.PI * t / dur) ** 2);

export function mix(out, src, at = 0, gain = 1) { const o = Math.floor(at * SR); for (let i = 0; i < src.length && o + i < out.length; i++) if (o + i >= 0) out[o + i] += src[i] * gain; return out; }
export function drive(b, k = 2) { const n = Math.tanh(k); for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * k) / n; return b; }
export function gain(b, g) { for (let i = 0; i < b.length; i++) b[i] *= g; return b; }

/** Karplus–Strong pluck. */
export function pluck(f, sec, amp = 1, damp = 0.996, bright = 0.5) {
  const out = buf(sec); const N = Math.max(2, Math.round(SR / f)); const line = new Float32Array(N);
  for (let i = 0; i < N; i++) line[i] = noise();
  let lp = 0; for (let i = 0; i < N; i++) { lp = lp + bright * (line[i] - lp); line[i] = lp; }
  let p = 0;
  for (let i = 0; i < out.length; i++) {
    const a = line[p], bb = line[(p + 1) % N];
    line[p] = damp * 0.5 * (a + bb); out[i] = a * amp; p = (p + 1) % N;
  }
  return out;
}

/** Freeverb-ish: 8 combs + 4 allpasses, mono. Returns the wet signal only. */
export function reverb(b, room = 0.84, damp = 0.3, tail = 1.5) {
  const out = new Float32Array(b.length + Math.ceil(tail * SR));
  const k = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((n) => ({ l: new Float32Array(Math.round(n * k)), p: 0, s: 0 }));
  const aps = [556, 441, 341, 225].map((n) => ({ l: new Float32Array(Math.round(n * k)), p: 0 }));
  for (let i = 0; i < out.length; i++) {
    const x = (i < b.length ? b[i] : 0) * 0.015;
    let y = 0;
    for (const c of combs) { const o = c.l[c.p]; c.s = o * (1 - damp) + c.s * damp; c.l[c.p] = x + c.s * room; c.p = (c.p + 1) % c.l.length; y += o; }
    for (const a of aps) { const o = a.l[a.p]; const v = -y + o; a.l[a.p] = y + o * 0.5; a.p = (a.p + 1) % a.l.length; y = v; }
    out[i] = y;
  }
  return out;
}
/** Dry + wet, with the tail kept. */
export function withVerb(b, wet = 0.3, room = 0.84, damp = 0.3, tail = 1.2) {
  const w = reverb(b, room, damp, tail); const out = new Float32Array(w.length);
  for (let i = 0; i < out.length; i++) out[i] = (i < b.length ? b[i] : 0) + w[i] * wet;
  return out;
}
/** Wrap a rendered loop's overhang (reverb tails) back onto its start, so it loops seamlessly. */
export function foldLoop(b, loopSec) {
  const n = Math.round(loopSec * SR); const out = new Float32Array(n);
  for (let i = 0; i < b.length; i++) out[i % n] += b[i];
  return out;
}
export function trimSilence(b, thresh = 0.0008) { let e = b.length; while (e > 1 && Math.abs(b[e - 1]) < thresh) e--; return b.slice(0, Math.min(b.length, e + 200)); }
export function normalize(b, peak = 0.89) { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); if (m > 0) gain(b, peak / m); return b; }
export function fadeEdges(b, inS = 0.002, outS = 0.01) { const a = inS * SR, z = outS * SR; for (let i = 0; i < a && i < b.length; i++) b[i] *= i / a; for (let i = 0; i < z && i < b.length; i++) b[b.length - 1 - i] *= i / z; return b; }

export function writeMp3(path, b, kbps = 96) {
  const enc = new Mp3Encoder(1, SR, kbps); const pcm = new Int16Array(b.length);
  for (let i = 0; i < b.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round(b[i] * 32767)));
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) { const c = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (c.length) chunks.push(Buffer.from(c)); }
  const f = enc.flush(); if (f.length) chunks.push(Buffer.from(f));
  fs.writeFileSync(path, Buffer.concat(chunks));
}
export function writeWav(path, b) {
  const pcm = Buffer.alloc(44 + b.length * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + b.length * 2, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(b.length * 2, 40);
  for (let i = 0; i < b.length; i++) pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(b[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(path, pcm);
}
