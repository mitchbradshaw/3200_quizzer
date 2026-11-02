// Splits a lab's first render into two tasks: the visible simulation first, below-the-fold content
// (the predict-then-reveal blocks) one task later, so opening a lab never blocks the page for long.
import { useEffect, useState } from 'react';

/** false on the first render, true from the next task on. */
export function useMountLater(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(id);
  }, []);
  return ready;
}
