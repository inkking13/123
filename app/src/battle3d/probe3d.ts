import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// A phone can kill the app outright while a 3D view starts up (out of GPU
// memory, a driver fault), which no JS error handler sees. So every 3D view
// marks "3D starting" on mount and clears it once it has run for a while or
// closes normally. If the mark is still there on the next launch, the app died
// inside 3D: the game then starts on the lowest graphics rather than crashing again.

const KEY = 'raid-commander.3d-probe';
const SETTLED_MS = 8000;

export function use3dProbe() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    AsyncStorage.setItem(KEY, '1').catch(() => {});
    const t = setTimeout(() => { AsyncStorage.setItem(KEY, '0').catch(() => {}); }, SETTLED_MS);
    return () => { clearTimeout(t); AsyncStorage.setItem(KEY, '0').catch(() => {}); };
  }, []);
}

/** True (once) if the last run died while a 3D view was starting. */
export async function diedIn3dLastRun(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === '1') { await AsyncStorage.setItem(KEY, '0'); return true; }
  } catch {}
  return false;
}
