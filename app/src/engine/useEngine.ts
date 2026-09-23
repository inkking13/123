import { useSyncExternalStore } from 'react';
import { GameEngine } from './GameEngine';

/** Subscribes the calling component to engine mutations; re-renders on notify(). */
export function useEngineVersion(engine: GameEngine): number {
  return useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
}
