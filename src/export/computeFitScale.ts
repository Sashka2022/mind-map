export type PaperSize = 'A4' | 'A3';
export type Orientation = 'landscape' | 'portrait';

export interface PageSpec {
  paper: PaperSize;
  orientation: Orientation;
  marginMm?: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FitResult {
  scale: number;
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
  /** Flow-space offset that brings the content's top-left corner to (0,0). */
  offsetX: number;
  offsetY: number;
}

/** React Flow's coordinate space is CSS px; 96 CSS px == 1 inch == 25.4mm. */
const FLOW_PX_PER_MM = 96 / 25.4;

const PAPER_MM: Record<PaperSize, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
};

const MIN_CONTENT_PX = 40;

/** Computes the uniform scale needed to fit `bounds` fully inside the given page. */
export function computeFitScale(bounds: Bounds, page: PageSpec): FitResult {
  const marginMm = page.marginMm ?? 10;
  const [shortMm, longMm] = PAPER_MM[page.paper];
  const [pageWidthMm, pageHeightMm] =
    page.orientation === 'landscape' ? [longMm, shortMm] : [shortMm, longMm];

  const availWidthPx = (pageWidthMm - 2 * marginMm) * FLOW_PX_PER_MM;
  const availHeightPx = (pageHeightMm - 2 * marginMm) * FLOW_PX_PER_MM;

  const contentWidth = Math.max(bounds.width, MIN_CONTENT_PX);
  const contentHeight = Math.max(bounds.height, MIN_CONTENT_PX);

  const scale = Math.min(availWidthPx / contentWidth, availHeightPx / contentHeight);

  return {
    scale,
    pageWidthMm,
    pageHeightMm,
    marginMm,
    offsetX: -bounds.x,
    offsetY: -bounds.y,
  };
}
