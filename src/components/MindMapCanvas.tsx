import { useEffect, useMemo, useRef } from 'react';
import { Background, Controls, ReactFlow, ReactFlowProvider, getViewportForBounds, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMapStore } from '../store/mapStore';
import { nodeTypes } from './nodeTypes';
import { buildFlowGraph } from '../flowGraph';
import { DEFAULT_NODE_SIZE } from '../layout/treeLayout';
import { symmetrizeBounds } from '../layout/bounds';
import type { Point, Size } from '../types';

const FIT_PADDING = 0.25;

function computeContentBounds(positions: Record<string, Point>, sizes: Record<string, Size>) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of Object.keys(positions)) {
    const center = positions[id];
    const size = sizes[id] ?? DEFAULT_NODE_SIZE;
    minX = Math.min(minX, center.x - size.width / 2);
    maxX = Math.max(maxX, center.x + size.width / 2);
    minY = Math.min(minY, center.y - size.height / 2);
    maxY = Math.max(maxY, center.y + size.height / 2);
  }

  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function CanvasInner() {
  const nodes = useMapStore((s) => s.nodes);
  const rootId = useMapStore((s) => s.rootId);
  const sizes = useMapStore((s) => s.sizes);
  const positions = useMapStore((s) => s.positions);
  const setNodeOverride = useMapStore((s) => s.setNodeOverride);
  const reactFlow = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const latestLayout = useRef({ positions, sizes });
  latestLayout.current = { positions, sizes };

  const { flowNodes, flowEdges } = useMemo(
    () => buildFlowGraph(nodes, rootId, sizes, positions),
    [nodes, rootId, sizes, positions],
  );

  // Never fires while the user is actively dragging a node — re-centering
  // mid-drag would yank the view out from under their cursor.
  function scheduleRecenter() {
    if (isDraggingRef.current) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (isDraggingRef.current) return;
      const container = wrapRef.current;
      const rawBounds = computeContentBounds(latestLayout.current.positions, latestLayout.current.sizes);
      const rootCenter = latestLayout.current.positions[rootId];
      if (!container || !rawBounds) return;
      // Keep the root visually centered even when one branch is bigger than
      // its opposite, instead of the view drifting toward the fuller side.
      const bounds = rootCenter ? symmetrizeBounds(rawBounds, rootCenter) : rawBounds;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const viewport = getViewportForBounds(bounds, rect.width, rect.height, 0.15, 1.5, FIT_PADDING);
      reactFlow.setViewport(viewport);
    }, 120);
  }

  // React Flow's own `fitView` depends on it having measured every node's
  // real DOM size first, and our nodes intentionally have no forced
  // width/height (so text never wraps mid-word — see NodeBox/flowGraph).
  // To avoid depending on that timing, center the viewport ourselves from
  // the tree layout's own (already-accurate) positions + measured sizes.
  useEffect(() => {
    scheduleRecenter();
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, sizes]);

  // Dragging a node stores its new center as a manual override; the tree
  // layout then carries the node's whole subtree along with it (see
  // layout/treeLayout applyOverrides), giving a looser, hand-arranged feel
  // instead of the rigid auto grid.
  function handleNodeDrag(_event: unknown, node: { id: string; position: Point }) {
    const size = sizes[node.id] ?? DEFAULT_NODE_SIZE;
    setNodeOverride(node.id, {
      x: node.position.x + size.width / 2,
      y: node.position.y + size.height / 2,
    });
  }

  function handleNodeDragStart() {
    isDraggingRef.current = true;
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }

  function handleNodeDragStop(event: unknown, node: { id: string; position: Point }) {
    isDraggingRef.current = false;
    handleNodeDrag(event, node);
  }

  // Also re-center when the canvas itself resizes (window resize, phone
  // rotation, opening on a different screen size) — otherwise a viewport
  // fitted for a wide desktop window stays put and pushes content off
  // screen on a narrow one.
  useEffect(() => {
    const container = wrapRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => scheduleRecenter());
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeDrag={handleNodeDrag}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        panOnScroll
        zoomOnScroll
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1.6} color="#c9bce6" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );
}

export function MindMapCanvas() {
  return (
    <div className="canvas-wrap">
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  );
}
