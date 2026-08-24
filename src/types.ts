export type Direction = 'up' | 'down' | 'left' | 'right';

export const ALL_DIRECTIONS: Direction[] = ['right', 'left', 'down', 'up'];

export const MAX_MAIN_BRANCHES = 4;

/** Optional visual emphasis the user can put on any node, independent of level/direction. */
export type HighlightColor = 'yellow' | 'red' | 'pink';

export const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'red', 'pink'];

export const HIGHLIGHT_COLOR_LABELS: Record<HighlightColor, string> = {
  yellow: 'צהוב',
  red: 'אדום',
  pink: 'ורוד',
};

export interface MapNode {
  id: string;
  text: string;
  parentId: string | null;
  children: string[];
  achieved: boolean;
  /** Only set on level-1 nodes (direct children of the root). */
  direction?: Direction;
  /** User-chosen emphasis color, e.g. to flag an important topic. */
  highlightColor?: HighlightColor;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}
