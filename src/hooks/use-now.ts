import { useEffect, useState } from 'react';

/**
 * A clock that ticks, for anything that renders based on "is this in the past yet".
 *
 * Calling `Date.now()` straight in a render body is impure: with React Compiler enabled
 * (see `app.json` → `experiments.reactCompiler`) the result gets memoized on props and
 * frozen at first render, so a meeting that starts while the screen is open never flips
 * from "Join meeting" to "View recording". Reading time from state instead makes the
 * dependency explicit and re-renders when it actually changes.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
