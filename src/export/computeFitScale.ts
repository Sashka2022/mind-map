import type { Bounds } from '../layout/bounds';

export type { Bounds };
export type PaperSize = 'A4' | 'A3';
export type Orientation = 'landscape' | 'portrait';

export interface PageSpec {
  paper: PaperSize;
  orientation: Orientation;
  marginMm?: number;
}

export interface FitResult {
  scale: number;
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
  /** Flow-space offset that brings the content's top-left corner to (0,0). */
  offsetX: number;
  offsetY: number;
  /** Content size (flow px, post-floor) that `scale` was computed against — lets
   *  callers figure out the leftover space on the non-binding axis, to center it. */
  contentWidthPx: number;
  contentHeightPx: number;
}

/** React Flow's coordinate space is CSS px; 96 CSS px == 1 inch == 25.4mm. */
const FLOW_PX_PER_MM = 96 / 25.4;

const PAPER_MM: Record<PaperSize, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
};

const MIN_CONTENT_PX = 40;

/**
 * Scale below which the smallest node label (~15px) prints under ~6pt and
 * stops being comfortably readable. Used by `chooseAutoPage` to decide when
 * a bigger sheet is worth it instead of just shrinking further.
 */
export const MIN_READABLE_SCALE = 0.5;

const PAPER_SIZES: PaperSize[] = ['A4', 'A3'];
const ORIENTATIONS: Orientation[] = ['landscape', 'portrait'];

/** Computes the uniform scale needed to fit `bounds` fully inside the given page. */
export function computeFitScale(bounds: Bounds, page: PageSpec): FitResult {
  const marginMm = page.marginMm ?? 10;
  const [shortMm, longMm] = PAPER_MM[page.paper];
  const [pageWidthMm, pageHeightMm] =
    page.orientation === 'landscape' ? [longMm, shortMm] : [shortMm, longMm];

  const availWidthPx = (pageWidthMm - 2 * marginMm) * FLOW_PX_PER_MM;
  const availHeightPx = (pageHeightMm - 2 * marginMm) * FLOW_PX_PER_MM;

  const contentWidthPx = Math.max(bounds.width, MIN_CONTENT_PX);
  const contentHeightPx = Math.max(bounds.height, MIN_CONTENT_PX);

  const scale = Math.min(availWidthPx / contentWidthPx, availHeightPx / contentHeightPx);

  return {
    scale,
    pageWidthMm,
    pageHeightMm,
    marginMm,
    offsetX: -bounds.x,
    offsetY: -bounds.y,
    contentWidthPx,
    contentHeightPx,
  };
}

export interface AutoPageResult {
  paper: PaperSize;
  orientation: Orientation;
  fit: FitResult;
  /** False when even the largest sheet couldn't reach MIN_READABLE_SCALE. */
  meetsMinScale: boolean;
}

/**
 * Picks the smallest paper size and best-fitting orientation that keeps the
 * map above the minimum readable scale, so small maps stay compact and large
 * maps automatically move up to A3 instead of shrinking into unreadable
 * text. Falls back to whichever combination scales the content the most.
 */
export function chooseAutoPage(bounds: Bounds, minScale = MIN_READABLE_SCALE): AutoPageResult {
  const candidates = PAPER_SIZES.flatMap((paper) =>
    ORIENTATIONS.map((orientation) => ({ paper, orientation, fit: computeFitScale(bounds, { paper, orientation }) })),
  );

  const readable = candidates.filter((c) => c.fit.scale >= minScale);
  if (readable.length > 0) {
    // Smallest paper first (PAPER_SIZES order), then the orientation that
    // wastes the least page space (highest scale) for that paper.
    readable.sort((a, b) => PAPER_SIZES.indexOf(a.paper) - PAPER_SIZES.indexOf(b.paper) || b.fit.scale - a.fit.scale);
    return { ...readable[0], meetsMinScale: true };
  }

  const best = candidates.reduce((a, b) => (b.fit.scale > a.fit.scale ? b : a));
  return { ...best, meetsMinScale: false };
}
