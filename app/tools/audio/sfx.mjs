// Combat and UI sound effects, synthesized. `node sfx.mjs <outDir>`
import fs from 'fs';
import { SR, buf, osc, noiseInto, biquad, env, expDecay, bell, mix, drive, gain, pluck, withVerb, trimSilence, normalize, fadeEdges, writeMp3, hz, rnd } from './dsp.mjs';

const OUT = process.argv[2] || 'out';
fs.mkdirSync(OUT, { recursive: true });

// ── building blocks ──
function whoosh(sec, f0, f1, q = 1.4, amp = 1) {
  const b = noiseInto(sec, 1);
  biquad(b, 'bp', (t) => f0 * Math.pow(f1 / f0, t / sec), q);
  return env(b, (t) => bell(sec)(t) * amp);
}
function thump(f0, f1, sec, amp = 1) {
  const b = osc('sine', (t) => f1 + (f0 - f1) * Math.exp(-t * 30), sec, 1);
  return env(b, (t) => expDecay(sec / 4, 0.001)(t) * amp);
}
function crack(sec, fc, amp = 1) {
  const b = noiseInto(sec, 1); biquad(b, 'lp', fc, 0.9);
  return env(b, (t) => expDecay(sec / 5, 0.0005)(t) * amp);
}
function metal(f, sec, amp = 1) {
  const b = buf(sec);
  [[1, 1], [2.76, 0.6], [5.4, 0.35], [8.93, 0.2], [1.51, 0.4]].forEach(([r, a], i) =>
    osc('sine', f * r * (1 + (rnd() - 0.5) * 0.004), sec, (t) => a * Math.exp(-t * (3 + i * 2.5)), b));
  // Fade the tail out, so a ring that is cut short does not click.
  env(b, (t) => Math.min(1, (sec - t) / (sec * 0.45)));
  return gain(b, amp);
}

const S = {};

// Melee: a swing through the air, then the hit lands.
S.swing = () => { const b = whoosh(0.22, 350, 2200, 1.6); return b; };
S.hit = () => {
  const b = buf(0.35);
  mix(b, thump(160, 55, 0.3, 1));
  mix(b, crack(0.08, 1600, 0.9));
  mix(b, crack(0.02, 6000, 0.3));
  return drive(b, 1.6);
};
S.crit = () => {
  const b = buf(0.9);
  mix(b, whoosh(0.12, 600, 3000, 1.5, 0.6));
  mix(b, thump(190, 45, 0.45, 1.2), 0.08);
  mix(b, crack(0.12, 2600, 1), 0.08);
  mix(b, metal(420, 0.8, 0.5), 0.08);
  return withVerb(drive(b, 2.2), 0.35, 0.8, 0.35, 0.8);
};
// Bow: string twang, then the arrow thunks in.
S.bow = () => {
  const b = pluck(150, 0.35, 1, 0.99, 0.7);
  mix(b, whoosh(0.18, 1500, 4000, 2, 0.35), 0.05);
  return env(b, expDecay(0.12));
};
S.arrowHit = () => { const b = buf(0.2); mix(b, crack(0.05, 4000, 0.7)); mix(b, thump(260, 90, 0.12, 0.8)); return b; };
// Spells.
S.cast = () => {
  const sec = 0.55; const b = whoosh(sec, 250, 3200, 3, 0.8);
  const sh = buf(sec);
  [0, 7, 12].forEach((iv) => osc('sine', (t) => hz('A4') * Math.pow(2, iv / 12) * (1 + 0.01 * Math.sin(t * 40)), sec, (t) => bell(sec)(t) * 0.18, sh));
  mix(b, sh);
  return withVerb(b, 0.4);
};
S.boom = () => {
  const sec = 0.9; const b = noiseInto(sec, 1);
  biquad(b, 'lp', (t) => 200 + 3500 * Math.exp(-t * 7), 0.8);
  env(b, expDecay(0.22, 0.003));
  mix(b, thump(110, 38, 0.8, 1.3));
  // crackle
  for (let k = 0; k < 14; k++) mix(b, crack(0.012, 7000, 0.35 * rnd()), 0.05 + rnd() * 0.4);
  return withVerb(drive(b, 1.8), 0.3, 0.82, 0.4, 0.9);
};
S.heal = () => {
  const b = buf(0.9);
  ['E5', 'G#5', 'B5', 'E6'].forEach((n, i) => mix(b, metal(hz(n), 0.8, 0.28), i * 0.07));
  mix(b, whoosh(0.6, 800, 5000, 4, 0.25));
  return withVerb(b, 0.55, 0.88, 0.2, 1.4);
};
S.rally = () => {
  // War horn: detuned saws through a lowpass, a fifth on top.
  const sec = 1.0; const b = buf(sec);
  for (const [n, a] of [['G2', 0.5], ['G3', 0.35], ['D4', 0.18]]) for (const d of [-0.004, 0, 0.005]) osc('saw', (t) => hz(n) * (1 + d) * (1 - 0.03 * Math.exp(-t * 12)), sec, a / 3, b);
  biquad(b, 'lp', (t) => 500 + 900 * Math.min(1, t * 6), 1.2);
  env(b, (t) => Math.min(1, t / 0.07) * (t > 0.75 ? Math.max(0, 1 - (t - 0.75) / 0.25) : 1));
  return withVerb(drive(b, 1.4), 0.35, 0.86, 0.3, 1.2);
};
// Enemies.
S.enemySwing = () => {
  const b = whoosh(0.28, 180, 1100, 1.2, 1);
  const g = osc('saw', (t) => 75 - 20 * t, 0.28, (t) => bell(0.28)(t) * 0.25); biquad(g, 'lp', 400, 2);
  return drive(mix(b, g), 1.3);
};
S.windup = () => {
  const sec = 1.3; const b = noiseInto(sec, 1);
  biquad(b, 'lp', (t) => 120 + 500 * (t / sec) ** 2, 2);
  env(b, (t) => (t / sec) ** 1.6);
  mix(b, osc('sine', (t) => 42 + 30 * (t / sec), sec, (t) => 0.8 * (t / sec) ** 1.3));
  return fadeEdges(drive(b, 1.5), 0.01, 0.05);
};
S.boneDeath = () => {
  const b = buf(0.7);
  mix(b, thump(120, 50, 0.3, 0.8));
  for (let k = 0; k < 12; k++) { const c = noiseInto(0.025, 1); biquad(c, 'bp', 1800 + rnd() * 2600, 6); env(c, expDecay(0.006)); mix(b, c, 0.02 + (k / 12) ** 1.4 * 0.5, 1.6 * (1 - k / 14)); }
  return withVerb(b, 0.2, 0.7);
};
S.heroDown = () => {
  const b = buf(1.2);
  mix(b, thump(90, 40, 0.5, 1));
  const v = buf(1.1);
  for (const d of [-0.006, 0.006]) osc('saw', (t) => hz('D3') * (1 + d) * (1 - 0.12 * t), 1.1, (t) => bell(1.1)(t) * 0.25, v);
  biquad(v, 'bp', 700, 3); mix(b, v, 0.05);
  return withVerb(b, 0.4, 0.85, 0.35, 1.2);
};
S.dodge = () => whoosh(0.14, 1200, 5000, 2, 0.8);
S.step = () => { const b = buf(0.12); mix(b, thump(90, 60, 0.1, 0.6)); mix(b, crack(0.03, 900, 0.4)); return b; };
S.stun = () => {
  const b = buf(0.8);
  [0, 0.08, 0.16].forEach((at, i) => mix(b, metal(hz(['E6', 'C6', 'A5'][i]), 0.5, 0.3), at));
  return withVerb(b, 0.4);
};
// Outcomes.
function brass(notes, dur, amp = 0.3) {
  const b = buf(dur + 0.05);
  for (const n of notes) for (const d of [-0.003, 0.004]) osc('saw', hz(n) * (1 + d), dur, amp / 2, b);
  biquad(b, 'lp', (t) => 700 + 1600 * Math.min(1, t * 5), 1);
  return env(b, (t) => Math.min(1, t / 0.04) * (t > dur - 0.15 ? Math.max(0, (dur - t) / 0.15) : 1));
}
S.victory = () => {
  const b = buf(2.4);
  mix(b, brass(['G4', 'G3'], 0.18, 0.45), 0);
  mix(b, brass(['C5', 'C4'], 0.18, 0.45), 0.2);
  mix(b, brass(['E5', 'E4'], 0.18, 0.45), 0.4);
  mix(b, brass(['C4', 'G4', 'C5', 'E5', 'G5'], 1.4, 0.22), 0.6);
  mix(b, thump(90, 45, 0.6, 0.9), 0.6);
  return withVerb(drive(b, 1.3), 0.4, 0.86, 0.3, 1.4);
};
S.defeat = () => {
  const b = buf(2.6);
  mix(b, brass(['A3', 'E4'], 0.6, 0.25), 0);
  mix(b, brass(['F3', 'C4'], 0.6, 0.25), 0.6);
  mix(b, brass(['D3', 'A3', 'F4'], 1.3, 0.22), 1.2);
  biquad(b, 'lp', 1100, 0.7);
  return withVerb(b, 0.5, 0.88, 0.4, 1.6);
};
S.levelUp = () => {
  const b = buf(1.0);
  ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => mix(b, metal(hz(n), 0.6, 0.25), i * 0.06));
  return withVerb(b, 0.5, 0.88, 0.2, 1.2);
};
// UI.
S.click = () => { const b = osc('sine', (t) => 1800 - 900 * t * 20, 0.04, 1); env(b, expDecay(0.008)); mix(b, crack(0.01, 5000, 0.3)); return b; };
S.coin = () => { const b = buf(0.5); mix(b, metal(1760, 0.4, 0.4)); mix(b, metal(2637, 0.4, 0.35), 0.07); return withVerb(b, 0.25); };
S.page = () => whoosh(0.16, 900, 2500, 1.2, 0.5);

for (const [name, make] of Object.entries(S)) {
  let b = make();
  b = fadeEdges(normalize(trimSilence(b)), 0.001, 0.02);
  const quiet = { click: 0.45, step: 0.4, page: 0.4, dodge: 0.6, swing: 0.7 }[name] ?? 0.9;
  gain(b, quiet);
  writeMp3(`${OUT}/${name}.mp3`, b, 96);
  console.log(name, (b.length / SR).toFixed(2) + 's', fs.statSync(`${OUT}/${name}.mp3`).size + 'B');
}
