import { useEffect, useState } from "react";

interface ProgressiveOptions {
  /** How many blocks are on screen in the first commit. */
  initialCount: number;
  /** How many are appended each tick after that. */
  chunkSize: number;
  /** Gap between the ticks. */
  chunkIntervalMs: number;
  /**
   * Delay before the *first* extra chunk lands, so an intro animation on the
   * initial blocks can finish before more work hits the JS thread.
   */
  firstChunkDelayMs?: number;
}

/**
 * Mounts a long block list a few items at a time instead of all at once.
 *
 * A finished script is one commit's worth of work no matter how it's drawn,
 * and with the Skia renderer each block is a canvas — mounting the lot in a
 * single pass is what stalls the frame the script arrives on. Handing them
 * over in small batches keeps every individual commit cheap.
 */
export function useProgressiveBlocks<T>(
  blocks: T[],
  {
    initialCount,
    chunkSize,
    chunkIntervalMs,
    firstChunkDelayMs = 0,
  }: ProgressiveOptions,
): T[] {
  const [count, setCount] = useState(() =>
    Math.min(initialCount, blocks.length),
  );

  // A new script — first generation, or a revision replacing the old one —
  // restarts the reveal. Adjusted during render rather than in an effect so
  // there's no commit that shows the previous script's block count.
  const [prevBlocks, setPrevBlocks] = useState(blocks);
  if (blocks !== prevBlocks) {
    setPrevBlocks(blocks);
    setCount(Math.min(initialCount, blocks.length));
  }

  // `initialCount` is not known on the first render: the caller works it out by
  // measuring how much fills the screen, and it can only measure once the body
  // has a width. Growing into the real count is the normal path, so it's a
  // render-time adjustment too. Only ever grows — a shrinking count would
  // unmount blocks the reader is already looking at.
  const [prevInitialCount, setPrevInitialCount] = useState(initialCount);
  if (initialCount !== prevInitialCount) {
    setPrevInitialCount(initialCount);
    setCount((current) =>
      Math.max(current, Math.min(initialCount, blocks.length)),
    );
  }

  useEffect(() => {
    if (count >= blocks.length) return;

    const delay = count <= initialCount ? firstChunkDelayMs : chunkIntervalMs;
    const timeout = setTimeout(() => {
      setCount((current) => Math.min(current + chunkSize, blocks.length));
    }, delay);

    return () => clearTimeout(timeout);
  }, [
    count,
    blocks.length,
    initialCount,
    chunkSize,
    chunkIntervalMs,
    firstChunkDelayMs,
  ]);

  return count >= blocks.length ? blocks : blocks.slice(0, count);
}
