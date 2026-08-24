export type Direction = 'up' | 'down' | 'left' | 'right';

export const ALL_DIRECTIONS: Direction[] = ['right', 'left', 'down', 'up'];

export const MAX_MAIN_BRANCHES = 4;

export interface MapNode {
  id: string;
  text: string;
  parentId: string | null;
  children: string[];
  achieved: boolean;
  /** Only set on level-1 nodes (direct children of the root). */
  direction?: Direction;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}
