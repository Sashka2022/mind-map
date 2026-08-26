import { BRANCH_COLORS, type MapNode } from '../types';

/**
 * Every main branch (direct child of the root) is assigned a color by its
 * order among the root's children; every descendant inherits its branch's
 * color by walking up to that level-1 ancestor. The root itself falls back
 * to the first palette color.
 */
export function getInheritedBranchColor(
  nodes: Record<string, MapNode>,
  rootId: string,
  id: string,
): string {
  let current = nodes[id];
  while (current) {
    if (current.parentId === rootId) {
      const index = nodes[rootId]?.children.indexOf(current.id) ?? 0;
      return BRANCH_COLORS[(index < 0 ? 0 : index) % BRANCH_COLORS.length];
    }
    if (current.parentId === null) return BRANCH_COLORS[0];
    current = nodes[current.parentId];
  }
  return BRANCH_COLORS[0];
}
