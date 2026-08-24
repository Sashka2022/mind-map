import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeBox } from './NodeBox';
import { useMapStore } from '../../store/mapStore';
import { getInheritedDirection } from '../../layout/directions';
import type { Direction } from '../../types';

const SOURCE_POSITION: Record<Direction, Position> = {
  right: Position.Right,
  left: Position.Left,
  down: Position.Bottom,
  up: Position.Top,
};

const TARGET_POSITION: Record<Direction, Position> = {
  right: Position.Left,
  left: Position.Right,
  down: Position.Top,
  up: Position.Bottom,
};

export const BRANCH_TARGET_HANDLE = 'target';
export const BRANCH_SOURCE_HANDLE = 'source';

export function BranchNode({ id }: NodeProps) {
  const direction = useMapStore((s) => getInheritedDirection(s.nodes, id)) ?? 'right';

  return (
    <>
      <Handle type="target" id={BRANCH_TARGET_HANDLE} position={TARGET_POSITION[direction]} />
      <Handle type="source" id={BRANCH_SOURCE_HANDLE} position={SOURCE_POSITION[direction]} />
      <NodeBox id={id} />
    </>
  );
}
