import { ReactFlow, ReactFlowProvider, type Edge, type Node, type Viewport } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '../components/nodeTypes';
import { ExportModeContext } from './exportMode';

interface ExportFlowProps {
  nodes: Node[];
  edges: Edge[];
  width: number;
  height: number;
  viewport: Viewport;
}

/** A minimal, non-interactive React Flow instance used only to render a clean snapshot. */
export function ExportFlow({ nodes, edges, width, height, viewport }: ExportFlowProps) {
  return (
    <div style={{ width, height, background: '#ffffff' }}>
      <ExportModeContext.Provider value>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            defaultViewport={viewport}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
            minZoom={0.01}
            maxZoom={8}
          />
        </ReactFlowProvider>
      </ExportModeContext.Provider>
    </div>
  );
}
