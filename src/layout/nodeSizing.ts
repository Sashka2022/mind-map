import { useEffect, useRef, type RefObject } from 'react';
import type { Size } from '../types';

/**
 * Cheap heuristic used the instant a node is created, before it has painted.
 * The +150 base covers the box's fixed chrome regardless of text — padding,
 * border, the achieved-toggle circle, and the color-dot/add/delete buttons —
 * which a plain per-character estimate badly undercounts (real nodes measured
 * 85-95px wider than the old +48 constant predicted). Erring toward a slight
 * over-estimate is deliberate: the box only has to shrink a little once
 * ResizeObserver reports the real size, instead of growing outward and
 * overlapping its neighbor while that correction is pending.
 */
export function estimateSize(text: string): Size {
  const width = Math.min(320, Math.max(150, text.length * 7.5 + 150));
  return { width: Math.round(width), height: 50 };
}

function sizesRoughlyEqual(a: Size | undefined, b: Size): boolean {
  if (!a) return false;
  return Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}

/**
 * Reports the real measured DOM size of a node to a callback, only on change.
 * Pass `enabled: false` while the node is being actively edited — every
 * character typed resizes the input, and reporting each of those would
 * trigger a full map relayout (and the store write that comes with it) on
 * every keystroke. The final size still gets reported once editing ends and
 * the box naturally resizes again.
 */
export function useNodeSizeReporter(
  ref: RefObject<HTMLElement | null>,
  current: Size | undefined,
  onResize: (size: Size) => void,
  enabled = true,
) {
  const currentRef = useRef(current);
  currentRef.current = current;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      if (!enabledRef.current) return;
      const entry = entries[0];
      if (!entry) return;
      const size: Size = {
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      };
      if (!sizesRoughlyEqual(currentRef.current, size)) onResize(size);
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
