export type Direction = 'up' | 'down' | 'left' | 'right';

export const ALL_DIRECTIONS: Direction[] = ['right', 'left', 'down', 'up'];

/**
 * Each main branch (a direct child of the root) gets its own color from this
 * palette, picked by its order among the root's children — independent of
 * the 4-way layout direction, so branch identity keeps scaling even once
 * there are more branches than directions. Every descendant inherits its
 * branch's color (see layout/branchColor.ts) so a whole branch reads as one
 * color family, root to leaf.
 */
export const BRANCH_COLORS = [
  '#315dfb',
  '#e0468a',
  '#14b8a6',
  '#f97316',
  '#9d4edd',
  '#2fa84f',
  '#eab308',
  '#0891b2',
];

export interface MapNode {
  id: string;
  text: string;
  parentId: string | null;
  children: string[];
  achieved: boolean;
  /** Only set on level-1 nodes (direct children of the root). */
  direction?: Direction;
  /** User-toggled emphasis, rendered in the node's own inherited branch color. */
  highlighted?: boolean;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}
