// Progressive mounting for the heavier A5 simulations.
import { startTransition, useEffect, useState } from 'react';

/**
 * Returns 0 on the first render, then 1, 2, … up to `n`, one step after each previous step has been
 * painted (a frame, then a macrotask). A page can show its interactive part at once and add what sits
 * below the fold in later, short tasks, instead of rendering and laying out everything in one long task
 * when the route opens. Steps are transitions, so React may also split their rendering.
 */
export function useStaged(n: number): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= n) return;
    let fired = false;
    let next = 0;
    const go = () => {
      if (fired) return;
      fired = true;
      next = window.setTimeout(() => startTransition(() => setStage((s) => Math.min(n, s + 1))), 0);
    };
    const raf = requestAnimationFrame(go);
    const fallback = window.setTimeout(go, 250); // no frames in a hidden tab
    return () => {
      fired = true;
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
      clearTimeout(next);
    };
  }, [stage, n]);
  return stage;
}
