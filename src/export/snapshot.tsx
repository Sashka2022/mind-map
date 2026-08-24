import { toJpeg } from 'html-to-image';
import { createRoot } from 'react-dom/client';
import { getNodesBounds, type Edge, type Node } from '@xyflow/react';
import { ExportFlow } from './ExportFlow';
import { computeFitScale, type PageSpec } from './computeFitScale';

export interface SnapshotResult {
  dataUrl: string;
  pageWidthMm: number;
  pageHeightMm: number;
  pageWidthPx: number;
  pageHeightPx: number;
}

/**
 * Renders the map into an offscreen React Flow instance sized and scaled to
 * exactly fit the given page, then rasterizes it. Used by both the print and
 * PDF-export paths so "scale to fit" only has one implementation.
 */
export async function renderMapSnapshot(
  flowNodes: Node[],
  flowEdges: Edge[],
  page: PageSpec,
  dpi = 180,
): Promise<SnapshotResult> {
  const bounds = getNodesBounds(flowNodes);
  const fit = computeFitScale(bounds, page);

  const pxPerMm = dpi / 25.4;
  const pageWidthPx = Math.round(fit.pageWidthMm * pxPerMm);
  const pageHeightPx = Math.round(fit.pageHeightMm * pxPerMm);
  const marginPx = Math.round(fit.marginMm * pxPerMm);
  const zoom = fit.scale * (dpi / 96);
  const viewport = {
    x: marginPx + fit.offsetX * zoom,
    y: marginPx + fit.offsetY * zoom,
    zoom,
  };

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = `${pageWidthPx}px`;
  container.style.height = `${pageHeightPx}px`;
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    <ExportFlow
      nodes={flowNodes}
      edges={flowEdges}
      width={pageWidthPx}
      height={pageHeightPx}
      viewport={viewport}
    />,
  );
  // Wait for React to commit + the browser to paint before rasterizing,
  // so the capture isn't taken mid-layout. requestAnimationFrame never
  // fires on a hidden/backgrounded tab, hence the fallback timer.
  const paint = new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  const paintTimeout = new Promise<void>((resolve) => setTimeout(resolve, 300));
  await Promise.race([paint, paintTimeout]);
  await document.fonts.ready;

  try {
    const capture = toJpeg(container, {
      width: pageWidthPx,
      height: pageHeightPx,
      pixelRatio: 1,
      backgroundColor: '#ffffff',
      quality: 0.92,
      filter: (el) => !(el instanceof Element && el.classList?.contains('react-flow__attribution')),
    });
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('יצירת התמונה נמשכה זמן רב מדי')), 20000);
    });
    const dataUrl = await Promise.race([capture, timeout]);
    return { dataUrl, pageWidthMm: fit.pageWidthMm, pageHeightMm: fit.pageHeightMm, pageWidthPx, pageHeightPx };
  } finally {
    root.unmount();
    container.remove();
  }
}
