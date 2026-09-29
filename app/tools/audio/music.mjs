// Three seamless loops in D minor: the camp (calm, fire and lute), a fight (drums and low strings), the boss (faster, choir and brass).
import fs from 'fs';
import { SR, buf, osc, noiseInto, biquad, env, expDecay, mix, drive, gain, pluck, reverb, foldLoop, normalize, writeMp3, hz, rnd } from './dsp.mjs';

const OUT = process.argv[2] || 'out';
fs.mkdirSync(OUT, { recursive: true });

// ── instruments ──
function pad(notes, sec, amp = 0.2, cutoff = 900, attack = 1.2) {
  const b = buf(sec + 0.5);
  for (const n of notes) for (const d of [-0.006, 0, 0.007]) osc('saw', (t) => hz(n) * (1 + d) * (1 + 0.002 * Math.sin(t * 5 + d * 900)), sec + 0.5, amp / 3, b);
  biquad(b, 'lp', (t) => cutoff * (0.7 + 0.3 * Math.sin(t * 0.9)), 0.8);
  return env(b, (t) => Math.min(1, t / attack) * (t > sec ? Math.max(0, 1 - (t - sec) / 0.5) : 1));
}
function choir(notes, sec, amp = 0.2) {
  // Saws through two vowel formants ("aah").
  const b = buf(sec + 0.6);
  for (const n of notes) for (const d of [-0.008, 0.004, 0.011]) osc('saw', (t) => hz(n) * (1 + d) * (1 + 0.004 * Math.sin(t * 5.5 + d * 500)), sec + 0.6, amp / 3, b);
  const f1 = Float32Array.from(b), f2 = Float32Array.from(b);
  biquad(f1, 'bp', 750, 5); biquad(f2, 'bp', 1150, 6);
  const out = buf(sec + 0.6); mix(out, f1, 0, 1.4); mix(out, f2, 0, 1);
  return env(out, (t) => Math.min(1, t / 0.6) * (t > sec ? Math.max(0, 1 - (t - sec) / 0.6) : 1));
}
function lute(n, amp = 0.4, sec = 1.6) { const b = pluck(hz(n), sec, amp, 0.997, 0.45); biquad(b, 'lp', 3500); return b; }
function strings(n, sec, amp = 0.3, cutoff = 700) {
  const b = buf(sec);
  for (const d of [-0.004, 0.005]) osc('saw', hz(n) * (1 + d), sec, amp / 2, b);
  biquad(b, 'lp', cutoff, 1.3);
  return env(b, (t) => Math.min(1, t / 0.015) * Math.exp(-t * 2.2) * (t > sec - 0.03 ? (sec - t) / 0.03 : 1));
}
function brass(notes, sec, amp = 0.25) {
  const b = buf(sec);
  for (const n of notes) for (const d of [-0.003, 0.004]) osc('saw', hz(n) * (1 + d), sec, amp / 2, b);
  biquad(b, 'lp', (t) => 600 + 1400 * Math.min(1, t * 8) * Math.exp(-t * 1.5), 1.1);
  return env(b, (t) => Math.min(1, t / 0.03) * (t > sec - 0.1 ? Math.max(0, (sec - t) / 0.1) : 1));
}
function taiko(amp = 1, pitch = 1) {
  const b = osc('sine', (t) => (55 + 90 * Math.exp(-t * 28)) * pitch, 0.7, 1);
  env(b, expDecay(0.18, 0.001));
  const n = noiseInto(0.12, 1); biquad(n, 'lp', 900); env(n, expDecay(0.03));
  mix(b, n, 0, 0.5);
  return gain(drive(b, 1.5), amp);
}
function rim(amp = 0.3) { const b = noiseInto(0.06, 1); biquad(b, 'bp', 2400, 3); return env(b, (t) => expDecay(0.012)(t) * amp); }
function shaker(amp = 0.12) { const b = noiseInto(0.08, 1); biquad(b, 'hp', 6000); return env(b, (t) => Math.sin(Math.PI * t / 0.08) * amp); }
function fire(sec) {
  // Campfire: rumble plus scattered crackles.
  const b = noiseInto(sec, 0.05); biquad(b, 'lp', 300);
  for (let t = 0; t < sec; t += 0.03 + rnd() * 0.25) { const c = noiseInto(0.01 + rnd() * 0.02, 1); biquad(c, 'bp', 1500 + rnd() * 4000, 2); env(c, expDecay(0.004)); mix(b, c, t, 0.12 + rnd() * 0.2); }
  return b;
}

function render(name, loopSec, build, verb = 0.35, room = 0.86) {
  const dry = buf(loopSec + 4);
  build(dry);
  const w = reverb(dry, room, 0.3, 0.1);
  const full = new Float32Array(dry.length); for (let i = 0; i < full.length; i++) full[i] = dry[i] + w[i] * verb;
  const loop = normalize(foldLoop(full, loopSec), 0.8);
  writeMp3(`${OUT}/${name}.mp3`, loop, 80);
  console.log(name, loopSec.toFixed(1) + 's', fs.statSync(`${OUT}/${name}.mp3`).size + 'B');
}

// Camp: 64 bpm, 16 bars. Dm – Bb – Gm – A, a lute wandering over it, the fire underneath.
{
  const beat = 60 / 64, bar = beat * 4, bars = 16, L = bar * bars;
  const chords = [['D3', 'F3', 'A3'], ['Bb2', 'D3', 'F3'], ['G2', 'Bb2', 'D3'], ['A2', 'C#3', 'E3']];
  const bass = ['D2', 'Bb1', 'G1', 'A1'];
  const tune = [
    ['A4', 0], ['F4', 1], ['D4', 2], ['E4', 3], ['F4', 3.5], ['D5', 4], ['A4', 5], ['Bb4', 6.5], ['G4', 8], ['D4', 9], ['E4', 10], ['G4', 11],
    ['E4', 12], ['C#5', 13], ['A4', 14], ['E4', 15],
  ];
  render('music-camp', L, (b) => {
    for (let k = 0; k < bars; k++) {
      const c = k % 4, at = k * bar;
      mix(b, pad(chords[c], bar, 0.16, 800, 1.5), at);
      mix(b, strings(bass[c], bar, 0.28, 300), at);
      if (k >= 4) for (const [n, bt] of tune.filter(([, bt]) => Math.floor(bt / 4) === c)) mix(b, lute(k >= 8 && k < 12 ? n.replace(/\d/, (d) => String(+d)) : n, 0.35), at + (bt % 4) * beat);
      // Soft arpeggio in the second half.
      if (k >= 8) chords[c].forEach((n, i) => mix(b, lute(n.replace(/\d/, (d) => String(+d + 1)), 0.18, 1.2), at + (i * 2 + 1) * beat * 0.5));
    }
    mix(b, fire(L), 0, 0.8);
  }, 0.45, 0.9);
}

// Fight: 100 bpm, 16 bars. Taiko groove, a driving low-string ostinato, brass on the downbeats.
{
  const beat = 60 / 100, bar = beat * 4, bars = 16, L = bar * bars;
  const roots = ['D2', 'Bb1', 'C2', 'A1'];
  const chords = [['D3', 'F3', 'A3'], ['Bb2', 'D3', 'F3'], ['C3', 'E3', 'G3'], ['A2', 'C#3', 'E3']];
  const ost = [0, 0, 12, 0, 3, 0, 7, 5]; // semitones over the root, in 8ths
  render('music-battle', L, (b) => {
    for (let k = 0; k < bars; k++) {
      const c = k % 4, at = k * bar, root = hz(roots[c]);
      // drums
      [0, 1.5, 2, 3].forEach((bt, i) => mix(b, taiko(i === 0 ? 1 : 0.7, i === 2 ? 1.3 : 1), at + bt * beat, 0.55));
      for (let e = 0; e < 8; e++) mix(b, e % 2 ? shaker(0.1) : rim(0.12), at + e * beat / 2);
      if (k % 4 === 3) [3.25, 3.5, 3.75].forEach((bt) => mix(b, taiko(0.5, 1.6), at + bt * beat, 0.5));
      // ostinato
      ost.forEach((s, i) => { const f = root * Math.pow(2, s / 12); const n = strings('A1', beat / 2, 0.22, 900); mix(b, retune(n, f / hz('A1')), at + i * beat / 2); });
      // brass + pad
      if (k >= 4) mix(b, brass(chords[c], beat * 1.5, 0.16), at);
      mix(b, pad(chords[c], bar, 0.08, 700, 0.3), at);
    }
  }, 0.25, 0.8);
}

// Boss: 120 bpm, 16 bars, darker: Dm – Eb – Dm – C#dim, choir over pounding drums.
{
  const beat = 60 / 120, bar = beat * 4, bars = 16, L = bar * bars;
  const roots = ['D2', 'Eb2', 'D2', 'C#2'];
  const chords = [['D3', 'F3', 'A3'], ['Eb3', 'G3', 'Bb3'], ['D3', 'F3', 'A3'], ['C#3', 'E3', 'G3']];
  const ost = [0, 0, 1, 0, 0, 0, 3, 1];
  render('music-boss', L, (b) => {
    for (let k = 0; k < bars; k++) {
      const c = k % 4, at = k * bar, root = hz(roots[c]);
      [0, 0.5, 1, 2, 2.5, 3].forEach((bt, i) => mix(b, taiko(bt % 1 ? 0.55 : 1, bt === 1 || bt === 3 ? 1.4 : 1), at + bt * beat, 0.5));
      for (let e = 0; e < 8; e++) mix(b, rim(e % 2 ? 0.08 : 0.14), at + e * beat / 2);
      ost.forEach((s, i) => { const n = strings('A1', beat / 2, 0.24, 1100); mix(b, retune(n, root * Math.pow(2, s / 12) / hz('A1')), at + i * beat / 2); });
      if (k % 2 === 0) mix(b, choir(chords[c].map((n) => n.replace(/\d/, (d) => String(+d + 1))), bar * 2, 0.22), at);
      if (k >= 8) mix(b, brass(chords[c], beat, 0.2), at + beat * 3);
    }
  }, 0.3, 0.84);
}

/** Resample a short note by a pitch ratio (cheap, fine for low strings). */
function retune(b, ratio) {
  const out = new Float32Array(Math.floor(b.length / ratio));
  for (let i = 0; i < out.length; i++) { const x = i * ratio, j = Math.floor(x), f = x - j; out[i] = (b[j] ?? 0) * (1 - f) + (b[j + 1] ?? 0) * f; }
  return out;
}
