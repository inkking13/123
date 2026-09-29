import { useEffect, useRef } from 'react';
import { Sim } from '../combat/types';
import { impactDelay } from '../components/CombatFx';
import { HERO_LOOKS } from '../battle3d/heroLooks';
import { sfx } from './audio';

interface Snap {
  fx: number; impact: number; dodge: number; move: number;
  foeHp: number; heroHp: Map<number, number>;
  foesAlive: Set<string>; heroesAlive: Set<number>;
  windup: boolean; stunned: boolean; victory: boolean; over: boolean;
}

function snap(s: Sim): Snap {
  const foes = [...s.enemies, ...s.minions];
  return {
    fx: s.fx.seq, impact: s.impact.seq, dodge: s.dodge.seq, move: s.moveFx?.seq ?? 0,
    foeHp: (s.enemies.length ? 0 : s.boss.hp) + foes.reduce((a, e) => a + (e.alive ? e.hp : 0), 0),
    heroHp: new Map(s.raiders.map((r) => [r.id, r.hp])),
    foesAlive: new Set([...foes.filter((e) => e.alive).map((e) => 'e' + e.id), ...(s.enemies.length || s.boss.hp <= 0 ? [] : ['boss'])]),
    heroesAlive: new Set(s.raiders.filter((r) => r.alive).map((r) => r.id)),
    windup: s.windup, stunned: s.stunned, victory: s.victory, over: s.over,
  };
}

/** Plays the fight: every attack, hit, death and turn of the battle gets its sound, timed with what is on screen. */
export function useCombatSounds(s: Sim | null) {
  const prev = useRef<Snap | null>(null);
  useEffect(() => {
    if (!s) { prev.current = null; return; }
    const now = snap(s);
    const was = prev.current;
    prev.current = now;
    if (!was) return;
    const f = s.fx;
    const delay = impactDelay(f);

    // Someone acts.
    if (now.fx !== was.fx) {
      const hero = typeof f.actor === 'number' ? s.raiders.find((r) => r.id === f.actor) : undefined;
      const archer = !!hero && HERO_LOOKS[hero.candidateId]?.weapon === 'bow';
      switch (f.kind) {
        case 'melee': sfx('swing'); break;
        case 'ranged': sfx(archer ? 'bow' : 'cast', archer ? {} : { rate: 1.5, volume: 0.6 }); break;
        case 'ability': sfx('cast'); break;
        case 'heal': sfx('heal', { delay }); break;
        case 'rally': sfx('rally'); break;
        case 'enemy': sfx('enemySwing'); break;
      }
    }

    // Blows land.
    if (now.foeHp < was.foeHp) {
      const archer = typeof f.actor === 'number' && HERO_LOOKS[s.raiders.find((r) => r.id === f.actor)?.candidateId ?? -1]?.weapon === 'bow';
      if (f.crit && typeof f.actor === 'number') sfx('crit', { delay });
      else if (f.kind === 'ability') sfx('boom', { delay, volume: 0.8 });
      else if (archer) sfx('arrowHit', { delay });
      else sfx('hit', { delay });
    }
    const hurt = [...now.heroHp].filter(([id, hp]) => hp < (was.heroHp.get(id) ?? hp)).length;
    if (hurt) sfx('hit', { rate: 0.8, volume: Math.min(1, 0.6 + hurt * 0.15), delay: f.kind === 'enemy' && now.fx !== was.fx ? 160 : 0 });

    // Area blows, dodges, steps.
    if (now.impact !== was.impact && s.impact.cells.length) sfx('boom');
    if (now.dodge !== was.dodge) sfx('dodge');
    if (now.move !== was.move) { sfx('step'); sfx('step', { delay: 260, rate: 0.9 }); }

    // The enemy rears up; is stunned.
    if (now.windup && !was.windup) sfx('windup');
    if (now.stunned && !was.stunned) sfx('stun');

    // Deaths.
    const fell = [...was.foesAlive].filter((k) => !now.foesAlive.has(k));
    if (fell.length) sfx('boneDeath', { delay: delay + 120, rate: fell.includes('boss') ? 0.7 : 1, volume: fell.includes('boss') ? 1 : 0.85 });
    if ([...was.heroesAlive].some((id) => !now.heroesAlive.has(id))) sfx('heroDown', { delay: 150 });

    // The end.
    if (now.victory && !was.victory) sfx('victory', { delay: 350, spread: 0 });
  });
}
