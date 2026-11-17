import { useEffect } from 'react';

/** One cancellable clock; hidden tabs pause rather than skipping teaching steps. */
export function usePlayback(active: boolean, speed: number, advance: (elapsed: number) => void) {
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let previous = 0;
    let accumulated = 0;
    const tick = (time: number) => {
      if (document.hidden) {
        previous = 0;
        accumulated = 0;
      } else {
        accumulated += previous ? Math.min(80, time - previous) : 0;
        previous = time;
        if (accumulated >= 32) {
          advance(accumulated * speed);
          accumulated = 0;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, speed, advance]);
}
