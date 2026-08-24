import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyOverrides, computeLayout } from '../layout/treeLayout';
import { estimateSize } from '../layout/nodeSizing';
import { ALL_DIRECTIONS, MAX_MAIN_BRANCHES, type Direction, type MapNode, type Point, type Size } from '../types';

interface MapState {
  initialized: boolean;
  title: string;
  rootId: string;
  nodes: Record<string, MapNode>;
  sizes: Record<string, Size>;
  /** Pure auto-layout output — the structural skeleton, ignoring drags. */
  autoPositions: Record<string, Point>;
  /** User-dragged positions, keyed by node id (see layout/treeLayout applyOverrides). */
  overrides: Record<string, Point>;
  /** What's actually rendered: autoPositions with overrides carried through subtrees. */
  positions: Record<string, Point>;
  lastSavedAt: number | null;
  pendingDeleteId: string | null;
  /** Node that should immediately open in edit mode (set right after it's created). */
  editRequestId: string | null;

  initMap: (title: string) => void;
  addMainBranch: () => void;
  addChild: (parentId: string) => void;
  renameNode: (id: string, text: string) => void;
  toggleAchieved: (id: string) => void;
  deleteNode: (id: string) => void;
  countDescendants: (id: string) => number;
  setNodeSize: (id: string, size: Size) => void;
  setNodeOverride: (id: string, point: Point) => void;
  resetLayout: () => void;
  relayout: () => void;
  saveNow: () => void;
  requestDelete: (id: string) => void;
  cancelDelete: () => void;
  confirmDelete: () => void;
  clearEditRequest: () => void;
}

function makeNode(partial: Pick<MapNode, 'text' | 'parentId'> & Partial<MapNode>): MapNode {
  return {
    id: nanoid(8),
    children: [],
    achieved: false,
    ...partial,
  };
}

function freeDirection(nodes: Record<string, MapNode>, rootId: string): Direction | undefined {
  const used = new Set(nodes[rootId].children.map((id) => nodes[id].direction));
  return ALL_DIRECTIONS.find((d) => !used.has(d));
}

function collectDescendants(nodes: Record<string, MapNode>, id: string, out: string[] = []): string[] {
  for (const childId of nodes[id].children) {
    out.push(childId);
    collectDescendants(nodes, childId, out);
  }
  return out;
}

/** Recomputes the auto layout, then re-applies any manual drag overrides on top of it. */
function relayoutAll(
  nodes: Record<string, MapNode>,
  rootId: string,
  sizes: Record<string, Size>,
  overrides: Record<string, Point>,
): { autoPositions: Record<string, Point>; positions: Record<string, Point> } {
  const autoPositions = computeLayout(nodes, rootId, sizes);
  const positions = applyOverrides(autoPositions, overrides, nodes, rootId);
  return { autoPositions, positions };
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      initialized: false,
      title: '',
      rootId: '',
      nodes: {},
      sizes: {},
      autoPositions: {},
      overrides: {},
      positions: {},
      lastSavedAt: null,
      pendingDeleteId: null,
      editRequestId: null,

      initMap: (title) => {
        const rootId = nanoid(8);
        const personalId = nanoid(8);
        const professionalId = nanoid(8);
        const familyId = nanoid(8);
        const personalGrowth1Id = nanoid(8);
        const personalGrowth2Id = nanoid(8);
        const professionalGoalsId = nanoid(8);

        const nodes: Record<string, MapNode> = {
          [rootId]: makeNode({ id: rootId, text: title, parentId: null, children: [personalId, professionalId] }),
          [personalId]: makeNode({
            id: personalId,
            text: 'אישי',
            parentId: rootId,
            direction: 'right',
            children: [familyId, personalGrowth1Id],
          }),
          [professionalId]: makeNode({
            id: professionalId,
            text: 'מקצועי',
            parentId: rootId,
            direction: 'left',
            children: [personalGrowth2Id, professionalGoalsId],
          }),
          [familyId]: makeNode({ id: familyId, text: 'משפחה', parentId: personalId }),
          [personalGrowth1Id]: makeNode({ id: personalGrowth1Id, text: 'התפתחות אישית', parentId: personalId }),
          [personalGrowth2Id]: makeNode({ id: personalGrowth2Id, text: 'התפתחות אישית', parentId: professionalId }),
          [professionalGoalsId]: makeNode({ id: professionalGoalsId, text: 'מטרות מקצועיות', parentId: professionalId }),
        };

        const sizes: Record<string, Size> = {};
        for (const node of Object.values(nodes)) sizes[node.id] = estimateSize(node.text);

        const { autoPositions, positions } = relayoutAll(nodes, rootId, sizes, {});
        set({ initialized: true, title, rootId, nodes, sizes, autoPositions, positions, overrides: {} });
      },

      addMainBranch: () => {
        const { nodes, rootId, sizes, overrides } = get();
        const root = nodes[rootId];
        if (root.children.length >= MAX_MAIN_BRANCHES) return;
        const direction = freeDirection(nodes, rootId);
        if (!direction) return;

        const id = nanoid(8);
        const text = 'ענף חדש';
        const nextNodes: Record<string, MapNode> = {
          ...nodes,
          [id]: makeNode({ id, text, parentId: rootId, direction }),
          [rootId]: { ...root, children: [...root.children, id] },
        };
        const nextSizes = { ...sizes, [id]: estimateSize(text) };
        const { autoPositions, positions } = relayoutAll(nextNodes, rootId, nextSizes, overrides);
        set({ nodes: nextNodes, sizes: nextSizes, autoPositions, positions, editRequestId: id });
      },

      addChild: (parentId) => {
        const { nodes, rootId, sizes, overrides } = get();
        const parent = nodes[parentId];
        if (!parent) return;

        const id = nanoid(8);
        const text = 'נושא חדש';
        const nextNodes: Record<string, MapNode> = {
          ...nodes,
          [id]: makeNode({ id, text, parentId }),
          [parentId]: { ...parent, children: [...parent.children, id] },
        };
        const nextSizes = { ...sizes, [id]: estimateSize(text) };
        const { autoPositions, positions } = relayoutAll(nextNodes, rootId, nextSizes, overrides);
        set({ nodes: nextNodes, sizes: nextSizes, autoPositions, positions, editRequestId: id });
      },

      renameNode: (id, text) => {
        const { nodes, rootId, sizes, overrides } = get();
        const node = nodes[id];
        if (!node) return;
        const trimmed = text.trim() || node.text;
        const nextNodes = { ...nodes, [id]: { ...node, text: trimmed } };
        const { autoPositions, positions } = relayoutAll(nextNodes, rootId, sizes, overrides);
        set({ nodes: nextNodes, autoPositions, positions });
      },

      toggleAchieved: (id) => {
        const { nodes } = get();
        const node = nodes[id];
        if (!node || node.parentId === null) return;
        set({ nodes: { ...nodes, [id]: { ...node, achieved: !node.achieved } } });
      },

      countDescendants: (id) => {
        const { nodes } = get();
        if (!nodes[id]) return 0;
        return collectDescendants(nodes, id).length;
      },

      deleteNode: (id) => {
        const { nodes, rootId, sizes, overrides } = get();
        const node = nodes[id];
        if (!node || node.parentId === null) return;

        const toRemove = new Set([id, ...collectDescendants(nodes, id)]);
        const nextNodes: Record<string, MapNode> = {};
        for (const [nodeId, n] of Object.entries(nodes)) {
          if (toRemove.has(nodeId)) continue;
          nextNodes[nodeId] =
            nodeId === node.parentId ? { ...n, children: n.children.filter((c) => c !== id) } : n;
        }

        const nextSizes = { ...sizes };
        const nextOverrides = { ...overrides };
        for (const removedId of toRemove) {
          delete nextSizes[removedId];
          delete nextOverrides[removedId];
        }

        const { autoPositions, positions } = relayoutAll(nextNodes, rootId, nextSizes, nextOverrides);
        set({ nodes: nextNodes, sizes: nextSizes, overrides: nextOverrides, autoPositions, positions });
      },

      setNodeSize: (id, size) => {
        const { nodes, rootId, sizes, overrides } = get();
        if (!nodes[id]) return;
        const nextSizes = { ...sizes, [id]: size };
        const { autoPositions, positions } = relayoutAll(nodes, rootId, nextSizes, overrides);
        set({ sizes: nextSizes, autoPositions, positions });
      },

      setNodeOverride: (id, point) => {
        const { nodes, rootId, autoPositions, overrides } = get();
        if (!nodes[id]) return;
        const nextOverrides = { ...overrides, [id]: point };
        const positions = applyOverrides(autoPositions, nextOverrides, nodes, rootId);
        set({ overrides: nextOverrides, positions });
      },

      resetLayout: () => {
        const { nodes, rootId, autoPositions } = get();
        set({ overrides: {}, positions: applyOverrides(autoPositions, {}, nodes, rootId) });
      },

      relayout: () => {
        const { nodes, rootId, sizes, overrides } = get();
        if (!rootId) return;
        const { autoPositions, positions } = relayoutAll(nodes, rootId, sizes, overrides);
        set({ autoPositions, positions });
      },

      saveNow: () => set({ lastSavedAt: Date.now() }),

      requestDelete: (id) => {
        const node = get().nodes[id];
        if (!node || node.parentId === null) return;
        set({ pendingDeleteId: id });
      },
      cancelDelete: () => set({ pendingDeleteId: null }),
      confirmDelete: () => {
        const id = get().pendingDeleteId;
        if (!id) return;
        get().deleteNode(id);
        set({ pendingDeleteId: null });
      },

      clearEditRequest: () => set({ editRequestId: null }),
    }),
    {
      name: 'mind-map-storage',
      partialize: (state) => ({
        initialized: state.initialized,
        title: state.title,
        rootId: state.rootId,
        nodes: state.nodes,
        sizes: state.sizes,
        overrides: state.overrides,
      }),
      onRehydrateStorage: () => (state) => {
        state?.relayout();
      },
    },
  ),
);
