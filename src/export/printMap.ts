import type { Edge, Node } from '@xyflow/react';
import { renderMapSnapshot } from './snapshot';
import type { Bounds, PageSpec } from './computeFitScale';

const CONTAINER_ID = 'print-map-root';
const STYLE_ID = 'print-page-style';

/** Renders a scale-to-fit snapshot and sends it to the browser's print dialog. */
export async function printMap(
  flowNodes: Node[],
  flowEdges: Edge[],
  page: PageSpec,
  bounds?: Bounds,
): Promise<void> {
  const snapshot = await renderMapSnapshot(flowNodes, flowEdges, page, 200, bounds);

  document.getElementById(CONTAINER_ID)?.remove();
  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  const img = document.createElement('img');
  img.src = snapshot.dataUrl;
  img.alt = '';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'contain';
  container.appendChild(img);
  document.body.appendChild(container);

  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @page { size: ${page.paper} ${page.orientation}; margin: 0; }
    #${CONTAINER_ID} { display: none; }
    @media print {
      body > *:not(#${CONTAINER_ID}) { display: none !important; }
      #${CONTAINER_ID} {
        display: block !important;
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
      }
    }
  `;
  document.head.appendChild(style);

  const cleanup = () => {
    container.remove();
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });

  // window.print() only captures what the browser has already painted, so
  // the image must be fully decoded and given a chance to paint before
  // printing — otherwise the print preview/output comes out blank. rAF
  // never fires on a hidden/backgrounded tab, hence the fallback timeout.
  const paint = new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  const paintTimeout = new Promise<void>((resolve) => setTimeout(resolve, 300));
  await img.decode().catch(() => undefined);
  await Promise.race([paint, paintTimeout]);

  window.print();
}
