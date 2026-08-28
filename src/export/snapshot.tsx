import { toSvg } from 'html-to-image';
import { createRoot } from 'react-dom/client';
import { getNodesBounds, type Edge, type Node } from '@xyflow/react';
import { ExportFlow } from './ExportFlow';
import { computeFitScale, type Bounds, type PageSpec } from './computeFitScale';

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
 *
 * `bounds` defaults to the map's raw bounding box, but callers pass in a
 * root-symmetric box (see layout/bounds.ts) so the root stays centered on
 * the page even when one branch is bigger than its opposite.
 */
export async function renderMapSnapshot(
  flowNodes: Node[],
  flowEdges: Edge[],
  page: PageSpec,
  dpi = 180,
  bounds: Bounds = getNodesBounds(flowNodes),
): Promise<SnapshotResult> {
  const fit = computeFitScale(bounds, page);

  const pxPerMm = dpi / 25.4;
  const pageWidthPx = Math.round(fit.pageWidthMm * pxPerMm);
  const pageHeightPx = Math.round(fit.pageHeightMm * pxPerMm);
  const marginPx = Math.round(fit.marginMm * pxPerMm);
  const zoom = fit.scale * (dpi / 96);
  // The scale is bound by one axis; the other axis is left with slack
  // (page fully filled edge-to-edge would only happen if the aspect ratios
  // matched exactly). Split that slack evenly so the map sits centered on
  // the page instead of pinned to the top-left corner.
  const slackXPx = Math.max(0, pageWidthPx - 2 * marginPx - fit.contentWidthPx * zoom);
  const slackYPx = Math.max(0, pageHeightPx - 2 * marginPx - fit.contentHeightPx * zoom);
  const viewport = {
    x: marginPx + slackXPx / 2 + fit.offsetX * zoom,
    y: marginPx + slackYPx / 2 + fit.offsetY * zoom,
    zoom,
  };

  // html-to-image renders the captured element inside an SVG <foreignObject>;
  // if the captured element itself has `position: fixed`, that positioning
  // escapes the foreignObject's coordinate space and the content is drawn
  // off-canvas, producing a blank capture. So the offscreen positioning goes
  // on an outer host, and the plain (statically positioned) inner element is
  // what actually gets passed to toSvg.
  const offscreenHost = document.createElement('div');
  offscreenHost.style.position = 'fixed';
  offscreenHost.style.left = '-99999px';
  offscreenHost.style.top = '0';
  document.body.appendChild(offscreenHost);

  const container = document.createElement('div');
  container.style.width = `${pageWidthPx}px`;
  container.style.height = `${pageHeightPx}px`;
  offscreenHost.appendChild(container);

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
  // The fallback timer matters most on slow/mobile devices, where a large
  // map can still be laying out well past a desktop-tuned delay — too
  // short here and the capture below races a half-painted tree, which is
  // how the connecting lines end up missing from shares taken on phones.
  const paintTimeout = new Promise<void>((resolve) => setTimeout(resolve, 600));
  await Promise.race([paint, paintTimeout]);
  await document.fonts.ready;

  try {
    const rasterize = async () => {
      // html-to-image's own toJpeg/toPng draw the intermediate SVG to a
      // canvas internally right after the image's load event — but a
      // nested <svg> (React Flow draws every connecting line inside one,
      // positioned via `overflow: visible` rather than its own width/
      // height) doesn't reliably finish painting inside that image by the
      // time `load` fires, so every edge silently vanished from the
      // snapshot even though the serialized SVG itself was correct (a
      // plain <img src="that data URL"> shows the edges fine). Doing the
      // draw ourselves, with an explicit settle delay after decode, avoids
      // that race.
      const svgUrl = await toSvg(container, {
        width: pageWidthPx,
        height: pageHeightPx,
        backgroundColor: '#ffffff',
        filter: (el) => !(el instanceof Element && el.classList?.contains('react-flow__attribution')),
      });
      const img = new Image();
      img.src = svgUrl;
      // `decode()` only guarantees the outer SVG has decoded, not that the
      // nested <svg> of edges has finished painting internally (see the
      // race described above) — on slower mobile hardware that internal
      // paint reliably takes longer, so the settle delay below is deliberately
      // generous rather than tuned to desktop timing.
      await img.decode().catch(() => undefined);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      const canvas = document.createElement('canvas');
      canvas.width = pageWidthPx;
      canvas.height = pageHeightPx;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('לא ניתן היה ליצור קנבס לרינדור התמונה');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, pageWidthPx, pageHeightPx);
      return canvas.toDataURL('image/jpeg', 0.92);
    };

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('יצירת התמונה נמשכה זמן רב מדי')), 20000);
    });
    const dataUrl = await Promise.race([rasterize(), timeout]);
    return { dataUrl, pageWidthMm: fit.pageWidthMm, pageHeightMm: fit.pageHeightMm, pageWidthPx, pageHeightPx };
  } finally {
    root.unmount();
    offscreenHost.remove();
  }
}
