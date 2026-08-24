import jsPDF from 'jspdf';
import type { Edge, Node } from '@xyflow/react';
import { renderMapSnapshot } from './snapshot';
import type { PageSpec } from './computeFitScale';

export async function exportToPdf(
  flowNodes: Node[],
  flowEdges: Edge[],
  page: PageSpec,
  fileName: string,
): Promise<void> {
  const snapshot = await renderMapSnapshot(flowNodes, flowEdges, page, 200);

  const pdf = new jsPDF({
    orientation: page.orientation === 'landscape' ? 'l' : 'p',
    unit: 'mm',
    format: page.paper.toLowerCase() as 'a4' | 'a3',
  });
  pdf.addImage(snapshot.dataUrl, 'JPEG', 0, 0, snapshot.pageWidthMm, snapshot.pageHeightMm);
  pdf.save(fileName);
}
