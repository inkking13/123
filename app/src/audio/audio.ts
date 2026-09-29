import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

// Sound effects and music. The sounds were synthesized offline for this game
// (assets/audio). On the web they play through one shared AudioContext:
// decoded buffers, a gain for effects and one for music, and music tracks that
// cross-fade. Browsers keep audio locked until the first tap or key press, so
// the context is resumed then. Other platforms stay silent for now.

const SFX = {
  swing: require('../../assets/audio/swing.mp3'),
  hit: require('../../assets/audio/hit.mp3'),
  crit: require('../../assets/audio/crit.mp3'),
  bow: require('../../assets/audio/bow.mp3'),
  arrowHit: require('../../assets/audio/arrowHit.mp3'),
  cast: require('../../assets/audio/cast.mp3'),
  boom: require('../../assets/audio/boom.mp3'),
  heal: require('../../assets/audio/heal.mp3'),
  rally: require('../../assets/audio/rally.mp3'),
  enemySwing: require('../../assets/audio/enemySwing.mp3'),
  windup: require('../../assets/audio/windup.mp3'),
  boneDeath: require('../../assets/audio/boneDeath.mp3'),
  heroDown: require('../../assets/audio/heroDown.mp3'),
  dodge: require('../../assets/audio/dodge.mp3'),
  step: require('../../assets/audio/step.mp3'),
  stun: require('../../assets/audio/stun.mp3'),
  victory: require('../../assets/audio/victory.mp3'),
  defeat: require('../../assets/audio/defeat.mp3'),
  levelUp: require('../../assets/audio/levelUp.mp3'),
  click: require('../../assets/audio/click.mp3'),
  coin: require('../../assets/audio/coin.mp3'),
  page: require('../../assets/audio/page.mp3'),
};
const MUSIC = {
  camp: require('../../assets/audio/music-camp.mp3'),
  battle: require('../../assets/audio/music-battle.mp3'),
  boss: require('../../assets/audio/music-boss.mp3'),
};
export type SfxName = keyof typeof SFX;
export type MusicName = keyof typeof MUSIC;

const SFX_LEVEL = 0.8;
const MUSIC_LEVEL = 0.32;
const FADE = 1.4;

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
const buffers = new Map<number, Promise<AudioBuffer | null>>();
const lastPlayed = new Map<string, number>();
let sfxOn = true, musicOn = true;
let want: MusicName | null = null;
let playing: { name: MusicName; src: AudioBufferSourceNode; gain: GainNode } | null = null;

function context(): Ctx | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const AC = (window as any).AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC() as Ctx;
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? SFX_LEVEL : 0; sfxBus.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? MUSIC_LEVEL : 0; musicBus.connect(ctx.destination);
  // Unlock on the first gesture; hush while the tab is hidden.
  const unlock = () => { ctx?.resume().then(() => syncMusic()).catch(() => {}); };
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) ctx?.suspend().catch(() => {}); else ctx?.resume().catch(() => {}); });
  return ctx;
}

function load(mod: number): Promise<AudioBuffer | null> {
  let p = buffers.get(mod);
  if (!p) {
    const c = context();
    p = !c ? Promise.resolve(null) : fetch(Asset.fromModule(mod).uri)
      .then((r) => r.arrayBuffer())
      .then((a) => new Promise<AudioBuffer>((res, rej) => c.decodeAudioData(a, res, rej)))
      .catch(() => null);
    buffers.set(mod, p);
  }
  return p;
}

/** Start the audio system and fetch every effect ahead of the first fight. */
export function initAudio() {
  if (!context()) return;
  for (const mod of Object.values(SFX)) load(mod);
}

/**
 * Play an effect. `delay` in ms (to land with a hit you can see), `rate` shifts pitch,
 * and a small random spread keeps repeats from sounding identical. The same sound
 * started twice within 40 ms plays once.
 */
export function sfx(name: SfxName, opts: { volume?: number; rate?: number; delay?: number; spread?: number } = {}) {
  const c = context();
  if (!c || !sfxOn || c.state !== 'running') return;
  const now = performance.now() + (opts.delay ?? 0);
  if (now - (lastPlayed.get(name) ?? -1e9) < 40) return;
  lastPlayed.set(name, now);
  // Dev-only trace for playtest bots (they can't listen).
  if (__DEV__) ((globalThis as any).__sfxLog ??= []).push(name);
  load(SFX[name]).then((b) => {
    if (!b || !sfxBus) return;
    const src = c.createBufferSource(); src.buffer = b;
    const spread = opts.spread ?? 0.06;
    src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() - 0.5) * spread);
    const g = c.createGain(); g.gain.value = opts.volume ?? 1;
    src.connect(g).connect(sfxBus);
    src.start(c.currentTime + Math.max(0, (opts.delay ?? 0) / 1000));
  });
}

/** Which track should be playing (null for silence); cross-fades when it changes. */
export function music(name: MusicName | null) {
  want = name;
  syncMusic();
}

function syncMusic() {
  const c = context();
  if (!c || c.state !== 'running' || !musicBus) return;
  const target = musicOn ? want : null;
  if (playing?.name === target) return;
  const old = playing;
  playing = null;
  if (old) {
    old.gain.gain.cancelScheduledValues(c.currentTime);
    old.gain.gain.setValueAtTime(old.gain.gain.value, c.currentTime);
    old.gain.gain.linearRampToValueAtTime(0, c.currentTime + FADE);
    old.src.stop(c.currentTime + FADE + 0.05);
  }
  if (!target) return;
  const name = target;
  load(MUSIC[name]).then((b) => {
    if (!b || !musicBus || (musicOn ? want : null) !== name || playing?.name === name) return;
    const src = c.createBufferSource(); src.buffer = b; src.loop = true;
    const g = c.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(1, c.currentTime + FADE);
    src.connect(g).connect(musicBus);
    src.start();
    playing = { name, src, gain: g };
    if (__DEV__) (globalThis as any).__music = name;
  });
}

export function setAudioEnabled(effects: boolean, tracks: boolean) {
  sfxOn = effects; musicOn = tracks;
  const c = context();
  if (!c) return;
  sfxBus?.gain.setTargetAtTime(effects ? SFX_LEVEL : 0, c.currentTime, 0.05);
  musicBus?.gain.setTargetAtTime(tracks ? MUSIC_LEVEL : 0, c.currentTime, 0.1);
  syncMusic();
}
