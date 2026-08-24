import type { NodeTypes } from '@xyflow/react';
import { RootNode } from './nodes/RootNode';
import { BranchNode } from './nodes/BranchNode';

export const nodeTypes: NodeTypes = {
  root: RootNode,
  branch: BranchNode,
};
