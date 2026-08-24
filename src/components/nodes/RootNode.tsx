import { useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeBox } from './NodeBox';
import { useMapStore } from '../../store/mapStore';
import { ALL_DIRECTIONS, type Direction } from '../../types';

const HANDLE_POSITION: Record<Direction, Position> = {
  right: Position.Right,
  left: Position.Left,
  down: Position.Bottom,
  up: Position.Top,
};

export function rootSourceHandleId(direction: Direction): string {
  return `src-${direction}`;
}

export function RootNode({ id }: NodeProps) {
  // Selectors must return stable references; join to a primitive string
  // instead of building a new Set/array on every store read.
  const directionsKey = useMapStore((s) => {
    const root = s.nodes[id];
    if (!root) return '';
    return root.children.map((childId) => s.nodes[childId]?.direction ?? '').join(',');
  });
  const usedDirections = useMemo(() => new Set(directionsKey.split(',').filter(Boolean)), [directionsKey]);

  return (
    <>
      {ALL_DIRECTIONS.filter((d) => usedDirections.has(d)).map((direction) => (
        <Handle
          key={direction}
          type="source"
          id={rootSourceHandleId(direction)}
          position={HANDLE_POSITION[direction]}
        />
      ))}
      <NodeBox id={id} isRoot />
    </>
  );
}
