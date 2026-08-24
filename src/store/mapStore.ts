import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyOverrides, computeLayout } from '../layout/treeLayout';
import { estimateSize } from '../layout/nodeSizing';
import { ALL_DIRECTIONS, type Direction, type HighlightColor, type MapNode, type Point, type Size } from '../types';

interface MapState {
  initialized: boolean;
  title: string;
  /** Data URL of the onboarding photo/selfie, shown as the root's avatar. */
  photoUrl: string | null;
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
  /** True while the "reset the whole map" confirmation dialog is open. */
  pendingReset: boolean;
  /** Node that should immediately open in edit mode (set right after it's created). */
  editRequestId: string | null;

  initMap: (title: string, photoUrl?: string | null) => void;
  addMainBranch: () => void;
  addChild: (parentId: string) => void;
  renameNode: (id: string, text: string) => void;
  toggleAchieved: (id: string) => void;
  setNodeHighlight: (id: string, color: HighlightColor | null) => void;
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
  requestReset: () => void;
  cancelReset: () => void;
  confirmReset: () => void;
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

/**
 * No cap on how many main branches the root can have: prefer a direction
 * with no branch yet, and once all four are taken, pick whichever has the
 * fewest so new branches stay balanced around the root instead of piling
 * onto one side.
 */
function pickDirectionForNewBranch(nodes: Record<string, MapNode>, rootId: string): Direction {
  const counts: Record<Direction, number> = { right: 0, left: 0, down: 0, up: 0 };
  for (const childId of nodes[rootId].children) {
    const direction = nodes[childId].direction ?? 'right';
    counts[direction] += 1;
  }
  return ALL_DIRECTIONS.reduce((best, d) => (counts[d] < counts[best] ? d : best), ALL_DIRECTIONS[0]);
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
      photoUrl: null,
      rootId: '',
      nodes: {},
      sizes: {},
      autoPositions: {},
      overrides: {},
      positions: {},
      lastSavedAt: null,
      pendingDeleteId: null,
      pendingReset: false,
      editRequestId: null,

      initMap: (title, photoUrl = null) => {
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
        set({ initialized: true, title, photoUrl, rootId, nodes, sizes, autoPositions, positions, overrides: {} });
      },

      addMainBranch: () => {
        const { nodes, rootId, sizes, overrides } = get();
        const root = nodes[rootId];
        const direction = pickDirectionForNewBranch(nodes, rootId);

        const id = nanoid(8);
        const text = 'ענף חדש';
        // Start at the previous sibling's size (if any) instead of the
        // placeholder text's heuristic estimate, so the new branch opens at
        // the same distance from the root as the one before it — it still
        // resizes itself once the user types a real name (useNodeSizeReporter)
        // and can always be dragged/relayout-carried like any other node.
        const lastSiblingId = root.children[root.children.length - 1];
        const initialSize = (lastSiblingId && sizes[lastSiblingId]) || estimateSize(text);
        const nextNodes: Record<string, MapNode> = {
          ...nodes,
          [id]: makeNode({ id, text, parentId: rootId, direction }),
          [rootId]: { ...root, children: [...root.children, id] },
        };
        const nextSizes = { ...sizes, [id]: initialSize };
        const { autoPositions, positions } = relayoutAll(nextNodes, rootId, nextSizes, overrides);
        set({ nodes: nextNodes, sizes: nextSizes, autoPositions, positions, editRequestId: id });
      },

      addChild: (parentId) => {
        const { nodes, rootId, sizes, overrides } = get();
        const parent = nodes[parentId];
        if (!parent) return;

        const id = nanoid(8);
        const text = 'נושא חדש';
        // Same reasoning as addMainBranch: default to the previous sibling's
        // size so the new node opens at a consistent distance from its
        // parent, while remaining fully movable/resizable afterward.
        const lastSiblingId = parent.children[parent.children.length - 1];
        const initialSize = (lastSiblingId && sizes[lastSiblingId]) || estimateSize(text);
        const nextNodes: Record<string, MapNode> = {
          ...nodes,
          [id]: makeNode({ id, text, parentId }),
          [parentId]: { ...parent, children: [...parent.children, id] },
        };
        const nextSizes = { ...sizes, [id]: initialSize };
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

      setNodeHighlight: (id, color) => {
        const { nodes } = get();
        const node = nodes[id];
        if (!node) return;
        set({ nodes: { ...nodes, [id]: { ...node, highlightColor: color ?? undefined } } });
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

      requestReset: () => set({ pendingReset: true }),
      cancelReset: () => set({ pendingReset: false }),
      confirmReset: () =>
        set({
          initialized: false,
          title: '',
          photoUrl: null,
          rootId: '',
          nodes: {},
          sizes: {},
          autoPositions: {},
          overrides: {},
          positions: {},
          lastSavedAt: null,
          pendingDeleteId: null,
          pendingReset: false,
          editRequestId: null,
        }),

      clearEditRequest: () => set({ editRequestId: null }),
    }),
    {
      name: 'mind-map-storage',
      partialize: (state) => ({
        initialized: state.initialized,
        title: state.title,
        photoUrl: state.photoUrl,
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
