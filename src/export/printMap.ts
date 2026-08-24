import type { Edge, Node } from '@xyflow/react';
import { renderMapSnapshot } from './snapshot';
import type { PageSpec } from './computeFitScale';

const CONTAINER_ID = 'print-map-root';
const STYLE_ID = 'print-page-style';

/** Renders a scale-to-fit snapshot and sends it to the browser's print dialog. */
export async function printMap(flowNodes: Node[], flowEdges: Edge[], page: PageSpec): Promise<void> {
  const snapshot = await renderMapSnapshot(flowNodes, flowEdges, page, 200);

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

  window.print();
}
