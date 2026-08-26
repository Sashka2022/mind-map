import type { Edge, Node } from '@xyflow/react';
import type { MapNode, Point, Size } from './types';
import { DEFAULT_NODE_SIZE } from './layout/treeLayout';
import { getInheritedBranchColor } from './layout/branchColor';
import { rootSourceHandleId } from './components/nodes/RootNode';
import { BRANCH_SOURCE_HANDLE, BRANCH_TARGET_HANDLE } from './components/nodes/BranchNode';

/** A 'default' (bezier) edge with its curvature path option. */
type OrganicEdge = Edge & { pathOptions?: { curvature?: number } };

interface BuildFlowGraphOptions {
  /**
   * Pin each node's DOM box to its measured size instead of letting it size
   * to content. Needed for the offscreen export snapshot (deterministic,
   * one-shot render); must be left off for the live canvas or React Flow's
   * inline width/height style permanently caps the box, forcing text to wrap
   * mid-word once content outgrows our first-paint heuristic estimate.
   */
  forceSize?: boolean;
}

function computeDepth(nodes: Record<string, MapNode>, id: string, cache: Map<string, number>): number {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  const node = nodes[id];
  const depth = node?.parentId ? computeDepth(nodes, node.parentId, cache) + 1 : 0;
  cache.set(id, depth);
  return depth;
}

/** Builds the React Flow nodes/edges arrays from the map's tree, sizes and positions. */
export function buildFlowGraph(
  nodes: Record<string, MapNode>,
  rootId: string,
  sizes: Record<string, Size>,
  positions: Record<string, Point>,
  options: BuildFlowGraphOptions = {},
): { flowNodes: Node[]; flowEdges: OrganicEdge[] } {
  const flowNodes: Node[] = [];
  const flowEdges: OrganicEdge[] = [];
  const depthCache = new Map<string, number>();

  for (const node of Object.values(nodes)) {
    // treeLayout positions every node by its CENTER; React Flow wants top-left.
    const center = positions[node.id] ?? { x: 0, y: 0 };
    const size = sizes[node.id] ?? DEFAULT_NODE_SIZE;
    const position = { x: center.x - size.width / 2, y: center.y - size.height / 2 };

    flowNodes.push({
      id: node.id,
      type: node.id === rootId ? 'root' : 'branch',
      position,
      data: {},
      ...(options.forceSize ? { width: size.width, height: size.height } : {}),
      draggable: !options.forceSize,
      selectable: false,
      connectable: false,
    });

    if (node.parentId) {
      // Branches taper like real ones: thicker near the trunk, finer toward the leaves.
      const depth = computeDepth(nodes, node.id, depthCache);
      const strokeWidth = Math.max(1.75, 5 - depth * 0.75);
      // Every edge takes on its branch's color, so a whole branch — line and
      // nodes alike — reads as one consistent color from root to leaf.
      const stroke = getInheritedBranchColor(nodes, rootId, node.id);

      flowEdges.push({
        id: `e-${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id,
        sourceHandle: node.parentId === rootId ? rootSourceHandleId(node.direction ?? 'right') : BRANCH_SOURCE_HANDLE,
        targetHandle: BRANCH_TARGET_HANDLE,
        type: 'default',
        pathOptions: { curvature: 0.45 },
        style: { stroke, strokeWidth, strokeLinecap: 'round', opacity: 0.75 },
      });
    }
  }

  return { flowNodes, flowEdges };
}
