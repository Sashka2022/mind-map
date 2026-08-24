import type { Direction, MapNode } from '../types';

/** Walks up to the level-1 ancestor to find the direction this node's branch grows in. */
export function getInheritedDirection(
  nodes: Record<string, MapNode>,
  id: string,
): Direction | undefined {
  let current = nodes[id];
  while (current) {
    if (current.direction) return current.direction;
    if (current.parentId === null) return undefined;
    current = nodes[current.parentId];
  }
  return undefined;
}
