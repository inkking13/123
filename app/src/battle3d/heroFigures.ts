import { WANDERER_HEIGHT, WandererModel } from './WandererModel';

/** Approximate standing height of each low-poly build, for anchoring HP bars and framing cameras. */
export const MODEL_HEIGHT = { human: 1.12, dwarf: 0.92, orc: 1.26, elf: 1.2, gnome: 0.95, brute: 1.35, golem: 1.5, imp: 0.95 } as const;

/** Heroes drawn with a sheet-built model instead of the generic rig. */
export const SHEET_MODELS: Record<number, { height: number; Model: typeof WandererModel }> = {
  4: { height: WANDERER_HEIGHT, Model: WandererModel }, // Векс — the hooded wanderer
};
