import type { Direction, MapNode, Point, Size } from '../types';

const LEVEL_GAP = 90;
const SIBLING_GAP = 28;
const ROOT_GAP = 130;
export const DEFAULT_NODE_SIZE: Size = { width: 150, height: 50 };
const DEFAULT_SIZE = DEFAULT_NODE_SIZE;

type Axis = 'x' | 'y';

const AXIS: Record<Direction, { primary: Axis; sign: 1 | -1 }> = {
  right: { primary: 'x', sign: 1 },
  left: { primary: 'x', sign: -1 },
  down: { primary: 'y', sign: 1 },
  up: { primary: 'y', sign: -1 },
};

function primaryOf(size: Size, axis: Axis): number {
  return axis === 'x' ? size.width : size.height;
}

function secondaryOf(size: Size, axis: Axis): number {
  return axis === 'x' ? size.height : size.width;
}

function getSize(sizes: Record<string, Size>, id: string): Size {
  return sizes[id] ?? DEFAULT_SIZE;
}

/** Bottom-up pass: extent of a subtree along the secondary (spread) axis. */
function computeExtent(
  nodeId: string,
  direction: Direction,
  nodes: Record<string, MapNode>,
  sizes: Record<string, Size>,
  extents: Record<string, number>,
): number {
  const axis = AXIS[direction];
  const node = nodes[nodeId];
  const ownExtent = secondaryOf(getSize(sizes, nodeId), axis.primary);

  if (node.children.length === 0) {
    extents[nodeId] = ownExtent;
    return ownExtent;
  }

  const childExtents = node.children.map((childId) =>
    computeExtent(childId, direction, nodes, sizes, extents),
  );
  const combined =
    childExtents.reduce((sum, e) => sum + e, 0) + (node.children.length - 1) * SIBLING_GAP;
  const extent = Math.max(ownExtent, combined);
  extents[nodeId] = extent;
  return extent;
}

/** Top-down pass: assign an absolute {x,y} to every node in the subtree. */
function assignPositions(
  nodeId: string,
  direction: Direction,
  primaryCoord: number,
  secondaryCoord: number,
  nodes: Record<string, MapNode>,
  sizes: Record<string, Size>,
  extents: Record<string, number>,
  positions: Record<string, Point>,
): void {
  const axis = AXIS[direction];
  const node = nodes[nodeId];
  positions[nodeId] =
    axis.primary === 'x'
      ? { x: primaryCoord, y: secondaryCoord }
      : { x: secondaryCoord, y: primaryCoord };

  if (node.children.length === 0) return;

  const total =
    node.children.reduce((sum, childId) => sum + extents[childId], 0) +
    (node.children.length - 1) * SIBLING_GAP;
  let cursor = secondaryCoord - total / 2;
  const ownPrimarySize = primaryOf(getSize(sizes, nodeId), axis.primary);

  for (const childId of node.children) {
    const extent = extents[childId];
    const childCenter = cursor + extent / 2;
    const childPrimarySize = primaryOf(getSize(sizes, childId), axis.primary);
    const childPrimary =
      primaryCoord + axis.sign * (ownPrimarySize / 2 + LEVEL_GAP + childPrimarySize / 2);
    assignPositions(childId, direction, childPrimary, childCenter, nodes, sizes, extents, positions);
    cursor += extent + SIBLING_GAP;
  }
}

/**
 * Computes a position for every node in the tree. Each of the root's children
 * (main branches) grows outward from the root in its assigned cardinal
 * direction; every descendant inherits that direction. Root itself is placed
 * at the origin. There's no cap on how many branches the root can have —
 * branches that share a direction are spread along the perpendicular axis
 * the same way a node's own children are (computeExtent/SIBLING_GAP), with
 * the whole group centered on the zero-line so a single branch in a
 * direction still lands exactly where it always did.
 */
export function computeLayout(
  nodes: Record<string, MapNode>,
  rootId: string,
  sizes: Record<string, Size>,
): Record<string, Point> {
  const positions: Record<string, Point> = { [rootId]: { x: 0, y: 0 } };
  const root = nodes[rootId];
  if (!root) return positions;

  const groups = new Map<Direction, string[]>();
  for (const branchId of root.children) {
    const direction = nodes[branchId].direction ?? 'right';
    (groups.get(direction) ?? groups.set(direction, []).get(direction)!).push(branchId);
  }

  for (const [direction, branchIds] of groups) {
    const axis = AXIS[direction];
    const extents: Record<string, number> = {};
    for (const branchId of branchIds) computeExtent(branchId, direction, nodes, sizes, extents);

    const total =
      branchIds.reduce((sum, id) => sum + extents[id], 0) + (branchIds.length - 1) * SIBLING_GAP;
    let cursor = -total / 2;
    const rootPrimarySize = primaryOf(getSize(sizes, rootId), axis.primary);

    for (const branchId of branchIds) {
      const extent = extents[branchId];
      const branchCenter = cursor + extent / 2;
      const branchPrimarySize = primaryOf(getSize(sizes, branchId), axis.primary);
      const primaryCoord = axis.sign * (rootPrimarySize / 2 + ROOT_GAP + branchPrimarySize / 2);
      assignPositions(branchId, direction, primaryCoord, branchCenter, nodes, sizes, extents, positions);
      cursor += extent + SIBLING_GAP;
    }
  }

  return positions;
}

/**
 * Lets the user drag any node to a manual position for a looser, more
 * organic arrangement while keeping the auto layout as the structural
 * skeleton. A dragged node's whole subtree is carried along with it (like
 * bending a real branch): each descendant keeps its auto-computed offset
 * from its parent's *effective* (possibly overridden) position, unless it
 * has its own override, which always wins for that node and everything
 * beneath it.
 */
export function applyOverrides(
  autoPositions: Record<string, Point>,
  overrides: Record<string, Point>,
  nodes: Record<string, MapNode>,
  rootId: string,
): Record<string, Point> {
  const effective: Record<string, Point> = {};

  function visit(nodeId: string, parentAutoPoint: Point | null, parentEffectivePoint: Point | null) {
    const auto = autoPositions[nodeId];
    if (!auto) return;

    let point: Point;
    if (overrides[nodeId]) {
      point = overrides[nodeId];
    } else if (parentAutoPoint && parentEffectivePoint) {
      point = {
        x: parentEffectivePoint.x + (auto.x - parentAutoPoint.x),
        y: parentEffectivePoint.y + (auto.y - parentAutoPoint.y),
      };
    } else {
      point = auto;
    }
    effective[nodeId] = point;

    const node = nodes[nodeId];
    for (const childId of node?.children ?? []) {
      visit(childId, auto, point);
    }
  }

  visit(rootId, null, null);
  return effective;
}
