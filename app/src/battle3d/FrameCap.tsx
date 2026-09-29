import { useEffect } from 'react';
import { useThree } from './r3f';

/**
 * Draws the scene at a fixed rate instead of every screen refresh. Use with
 * the Canvas's frameloop="demand": weak phones get a steady 30 fps and half
 * the GPU and JS work rather than a stuttering 60.
 */
export function FrameCap({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!fps) return;
    const t = setInterval(() => invalidate(), 1000 / fps);
    return () => clearInterval(t);
  }, [fps, invalidate]);
  return null;
}
