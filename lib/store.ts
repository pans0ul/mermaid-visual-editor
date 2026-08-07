import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeMarkerType,
  type Node,
  type NodeChange,
} from "@xyflow/react";

// ─── Node shape types ────────────────────────────────────────────────────────
export type NodeShape =
  | "rectangle"
  | "rounded"
  | "stadium"
  | "subroutine"
  | "cylinder"
  | "circle"
  | "double-circle"
  | "diamond"
  | "hexagon"
  | "parallelogram"
  | "parallelogram-alt"
  | "trapezoid"
  | "trapezoid-alt"
  | "asymmetric";

// ─── Edge style types ─────────────────────────────────────────────────────────
export type EdgeStyle = "solid" | "dashed" | "thick";
export type ArrowType = "arrow" | "none" | "bidirectional" | "circle" | "cross";

// ─── Diagram-level settings ───────────────────────────────────────────────────
export type Direction = "TD" | "LR" | "BT" | "RL";
export type Theme = "default" | "dark" | "forest" | "neutral" | "base";
export type Look = "classic" | "handDrawn";
export type CurveStyle =
  | "basis"
  | "bumpX"
  | "bumpY"
  | "cardinal"
  | "catmullRom"
  | "linear"
  | "monotoneX"
  | "monotoneY"
  | "natural"
  | "step"
  | "stepAfter"
  | "stepBefore";

// ─── Editor-level types ───────────────────────────────────────────────────────
export type BgVariant = 'dots' | 'lines' | 'cross'
export type EditorTheme = 'light' | 'dark'

// ─── Alignment types ──────────────────────────────────────────────────────────
export type AlignDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
export type DistributeDirection = 'horizontal' | 'vertical'

// ─── Data types ───────────────────────────────────────────────────────────────
export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  shape: NodeShape;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  isSubgraph?: boolean;
  locked?: boolean;
}

export interface FlowEdgeData extends Record<string, unknown> {
  edgeStyle?: EdgeStyle;
  arrowType?: ArrowType;
  strokeColor?: string;
  waypoints?: { x: number; y: number }[];
}

// ─── History snapshot ─────────────────────────────────────────────────────────
type Snapshot = {
  nodes: Node<FlowNodeData>[];
  edges: Edge<FlowEdgeData>[];
};

const MAX_HISTORY = 50;
let nodeCounter = 1;

// ─── Store interface ──────────────────────────────────────────────────────────
interface FlowState {
  nodes: Node<FlowNodeData>[];
  edges: Edge<FlowEdgeData>[];
  direction: Direction;
  theme: Theme;
  look: Look;
  curveStyle: CurveStyle;
  past: Snapshot[];
  future: Snapshot[];

  // React Flow change handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Node operations
  addNode: (shape?: NodeShape) => void;
  addNodeAtPosition: (
    position: { x: number; y: number },
    shape?: NodeShape,
    width?: number,
    height?: number,
  ) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeShape: (id: string, shape: NodeShape) => void;
  updateNodeStyle: (
    id: string,
    style: Partial<
      Pick<FlowNodeData, "fillColor" | "strokeColor" | "textColor">
    >,
  ) => void;
  setNodes: (nodes: Node<FlowNodeData>[]) => void;
  loadDiagram: (
    nodes: Node<FlowNodeData>[],
    edges: Edge<FlowEdgeData>[],
  ) => void;
  importDiagram: (
    nodes: Node<FlowNodeData>[],
    edges: Edge<FlowEdgeData>[],
    settings: { direction: Direction; theme: Theme; look: Look; curveStyle: CurveStyle },
  ) => void;

  // Subgraph operations
  addSubgraph: (title?: string) => void;
  assignToSubgraph: (nodeIds: string[], subgraphId: string | null) => void;

  // Edge operations
  updateEdgeLabel: (id: string, label: string) => void;
  updateEdgeType: (id: string, updates: Partial<FlowEdgeData>) => void;

  // Diagram settings
  setDirection: (direction: Direction) => void;
  setTheme: (theme: Theme) => void;
  setLook: (look: Look) => void;
  setCurveStyle: (curveStyle: CurveStyle) => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Selection operations
  duplicateSelected: () => void;
  clipboard: { nodes: Node<FlowNodeData>[]; edges: Edge<FlowEdgeData>[] } | null;
  copySelected: () => void;
  pasteClipboard: () => void;

  // Draw mode
  drawingShape: NodeShape | null;
  setDrawingShape: (shape: NodeShape | null) => void;

  // Canvas settings
  showMinimap: boolean;
  toggleMinimap: () => void;
  snapToGrid: boolean;
  snapGrid: [number, number];
  toggleSnapToGrid: () => void;
  setSnapGrid: (size: number) => void;
  bgVariant: BgVariant;
  bgGap: number;
  bgColor: string;
  bgSize: number;
  setBgVariant: (v: BgVariant) => void;
  setBgGap: (gap: number) => void;
  setBgColor: (color: string) => void;
  setBgSize: (size: number) => void;

  // Editor theme
  editorTheme: EditorTheme;
  toggleTheme: () => void;

  // Recent files
  recentFileNames: string[];
  addRecentFileName: (name: string) => void;
  clearRecentFileNames: () => void;

  // Lock
  toggleLock: (ids: string[]) => void;

  // Alignment
  alignNodes: (direction: AlignDirection) => void;
  distributeNodes: (direction: DistributeDirection) => void;

  // Z-ordering
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;
}

// ─── Helper: compute edge markers based on arrowType ─────────────────────────
function computeMarkers(arrowType: ArrowType): {
  markerEnd?: EdgeMarkerType;
  markerStart?: EdgeMarkerType;
} {
  if (arrowType === "none") return { markerEnd: undefined, markerStart: undefined };
  if (arrowType === "bidirectional") {
    return {
      markerEnd: { type: MarkerType.ArrowClosed },
      markerStart: { type: MarkerType.ArrowClosed },
    };
  }
  return { markerEnd: { type: MarkerType.ArrowClosed }, markerStart: undefined };
}

// ─── Alignment helpers ────────────────────────────────────────────────────────
function nodeCenter(n: Node<FlowNodeData>): { x: number; y: number; w: number; h: number } {
  const w = (n.measured?.width ?? n.style?.width) as number | undefined ?? 150
  const h = (n.measured?.height ?? n.style?.height) as number | undefined ?? 60
  return { x: n.position.x + w / 2, y: n.position.y + h / 2, w, h }
}

function computeAlign(nodes: Node<FlowNodeData>[], direction: AlignDirection): Node<FlowNodeData>[] {
  if (nodes.length < 2) return nodes
  const centers = nodes.map((n) => nodeCenter(n))
  const result = nodes.map((n) => ({ ...n, position: { ...n.position } }))

  if (direction === 'left') {
    const minX = Math.min(...result.map((n) => n.position.x))
    result.forEach((n) => { n.position.x = minX })
  } else if (direction === 'right') {
    const maxR = Math.max(...centers.map((c, i) => result[i].position.x + c.w))
    result.forEach((n, i) => { n.position.x = maxR - centers[i].w })
  } else if (direction === 'center') {
    const avgCx = centers.reduce((s, c) => s + c.x, 0) / centers.length
    result.forEach((n, i) => { n.position.x = avgCx - centers[i].w / 2 })
  } else if (direction === 'top') {
    const minY = Math.min(...result.map((n) => n.position.y))
    result.forEach((n) => { n.position.y = minY })
  } else if (direction === 'bottom') {
    const maxB = Math.max(...centers.map((c, i) => result[i].position.y + c.h))
    result.forEach((n, i) => { n.position.y = maxB - centers[i].h })
  } else if (direction === 'middle') {
    const avgCy = centers.reduce((s, c) => s + c.y, 0) / centers.length
    result.forEach((n, i) => { n.position.y = avgCy - centers[i].h / 2 })
  }
  return result
}

function computeDistribute(nodes: Node<FlowNodeData>[], direction: DistributeDirection): Node<FlowNodeData>[] {
  if (nodes.length < 3) return nodes
  const sorted = [...nodes].map((n, i) => ({ n, idx: i, c: nodeCenter(n) }))

  if (direction === 'horizontal') {
    sorted.sort((a, b) => a.n.position.x - b.n.position.x)
    const minX = sorted[0].n.position.x
    const maxR = sorted[sorted.length - 1].n.position.x + sorted[sorted.length - 1].c.w
    const totalW = sorted.reduce((s, item) => s + item.c.w, 0)
    const gap = (maxR - minX - totalW) / (sorted.length - 1)
    let cx = minX
    for (const item of sorted) {
      item.n.position = { x: cx, y: item.n.position.y }
      cx += item.c.w + gap
    }
  } else {
    sorted.sort((a, b) => a.n.position.y - b.n.position.y)
    const minY = sorted[0].n.position.y
    const maxB = sorted[sorted.length - 1].n.position.y + sorted[sorted.length - 1].c.h
    const totalH = sorted.reduce((s, item) => s + item.c.h, 0)
    const gap = (maxB - minY - totalH) / (sorted.length - 1)
    let cy = minY
    for (const item of sorted) {
      item.n.position = { x: item.n.position.x, y: cy }
      cy += item.c.h + gap
    }
  }
  return nodes
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useFlowStore = create<FlowState>((set, get) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withHistory = <T extends (...args: any[]) => void>(fn: T): T => {
    return ((...args: Parameters<T>) => {
      const { nodes: beforeNodes, edges: beforeEdges } = get();

      fn(...args);

      const { nodes: afterNodes, edges: afterEdges, past } = get();

      if (beforeNodes !== afterNodes || beforeEdges !== afterEdges) {
        const snapshot: Snapshot = {
          nodes: beforeNodes.map((n) => ({ ...n, data: { ...n.data } })),
          edges: beforeEdges.map((e) => ({
            ...e,
            data: { ...(e.data ?? {}) } as FlowEdgeData,
          })),
        };
        set({
          past: [...past.slice(-(MAX_HISTORY - 1)), snapshot],
          future: [],
        });
      }
    }) as T;
  };

  return {
    nodes: [],
    edges: [],
    direction: "TD",
    theme: "default",
    look: "classic",
    curveStyle: "basis",
    past: [],
    future: [],
    clipboard: null,
    drawingShape: null,
    setDrawingShape: (shape) => set({ drawingShape: shape }),

    // Canvas settings
    showMinimap: true,
    toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
    snapToGrid: false,
    snapGrid: [20, 20],
    toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
    setSnapGrid: (size) => set({ snapGrid: [size, size] }),
    bgVariant: 'dots',
    bgGap: 24,
    bgColor: '#d1d9e6',
    bgSize: 2,
    setBgVariant: (v) => set({ bgVariant: v }),
    setBgGap: (gap) => set({ bgGap: gap }),
    setBgColor: (color) => set({ bgColor: color }),
    setBgSize: (size) => set({ bgSize: size }),

    // Editor theme
    editorTheme: 'light',
    toggleTheme: () => set((s) => {
      const next = s.editorTheme === 'light' ? 'dark' : 'light'
      if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', next)
      return { editorTheme: next }
    }),

    // Recent files
    recentFileNames: [],
    addRecentFileName: (name) => set((s) => ({
      recentFileNames: [name, ...s.recentFileNames.filter((f) => f !== name)].slice(0, 10),
    })),
    clearRecentFileNames: () => set({ recentFileNames: [] }),

    // Lock
    toggleLock: (ids) => set({
      nodes: get().nodes.map((n) =>
        ids.includes(n.id) ? { ...n, data: { ...n.data, locked: !n.data.locked } } : n
      ),
    }),

    // Alignment
    alignNodes: withHistory((direction) => {
      const { nodes } = get()
      const selected = nodes.filter((n) => n.selected && !n.data.isSubgraph && !n.data.locked)
      if (selected.length < 2) return
      const ids = new Set(selected.map((n) => n.id))
      const aligned = computeAlign(selected, direction)
      set({ nodes: nodes.map((n) => (ids.has(n.id) ? aligned.find((a) => a.id === n.id) || n : n)) })
    }),

    distributeNodes: withHistory((direction) => {
      const { nodes } = get()
      const selected = nodes.filter((n) => n.selected && !n.data.isSubgraph && !n.data.locked)
      if (selected.length < 3) return
      const ids = new Set(selected.map((n) => n.id))
      const distributed = computeDistribute(selected, direction)
      set({ nodes: nodes.map((n) => (ids.has(n.id) ? distributed.find((a) => a.id === n.id) || n : n)) })
    }),

    bringToFront: (ids) => {
      const { nodes } = get()
      const maxZ = Math.max(...nodes.map((n) => n.zIndex ?? 0), 0)
      set({
        nodes: nodes.map((n) =>
          ids.includes(n.id) ? { ...n, zIndex: maxZ + 1 } : n
        ),
      })
    },

    sendToBack: (ids) => {
      const { nodes } = get()
      const minZ = Math.min(...nodes.map((n) => n.zIndex ?? 0), 0)
      set({
        nodes: nodes.map((n) =>
          ids.includes(n.id) ? { ...n, zIndex: minZ - 1 } : n
        ),
      })
    },

    pushHistory: () => {
      const { nodes, edges, past } = get();
      const snapshot: Snapshot = {
        nodes: nodes.map((n) => ({ ...n, data: { ...n.data } })),
        edges: edges.map((e) => ({
          ...e,
          data: { ...(e.data ?? {}) } as FlowEdgeData,
        })),
      };
      set({ past: [...past.slice(-(MAX_HISTORY - 1)), snapshot], future: [] });
    },

    undo: () => {
      const { past, nodes, edges, future } = get();
      if (past.length === 0) return;
      const prev = past[past.length - 1];
      const current: Snapshot = { nodes, edges };
      set({
        nodes: prev.nodes,
        edges: prev.edges,
        past: past.slice(0, -1),
        future: [current, ...future.slice(0, MAX_HISTORY - 1)],
      });
    },

    redo: () => {
      const { past, nodes, edges, future } = get();
      if (future.length === 0) return;
      const next = future[0];
      const current: Snapshot = { nodes, edges };
      set({
        nodes: next.nodes,
        edges: next.edges,
        past: [...past.slice(-(MAX_HISTORY - 1)), current],
        future: future.slice(1),
      });
    },

    onNodesChange: (changes) => {
      const lockedIds = new Set(get().nodes.filter((n) => n.data.locked).map((n) => n.id))
      const filtered = changes.filter((c) => {
        if ((c.type === 'position' || c.type === 'dimensions') && lockedIds.has(c.id)) return false
        return true
      })
      if (filtered.length === 0) return
      set({
        nodes: applyNodeChanges(filtered, get().nodes) as Node<FlowNodeData>[],
      })
    },

    onEdgesChange: (changes) =>
      set({
        edges: applyEdgeChanges(changes, get().edges) as Edge<FlowEdgeData>[],
      }),

    onConnect: withHistory((connection) => {
      const markers = computeMarkers("arrow");
      set({
        edges: addEdge(
          {
            ...connection,
            type: "flowEdge",
            markerEnd: markers.markerEnd,
            markerStart: markers.markerStart,
            data: { edgeStyle: "solid", arrowType: "arrow" },
          },
          get().edges,
        ) as Edge<FlowEdgeData>[],
      });
    }),

    addNode: withHistory((shape: NodeShape = "rectangle") => {
      const id = `node_${nodeCounter++}`;
      const offset = (nodeCounter * 30) % 200;
      const newNode: Node<FlowNodeData> = {
        id,
        type: "flowNode",
        position: { x: 150 + offset, y: 100 + offset },
        data: { label: "Node", shape },
      };
      set({ nodes: [...get().nodes, newNode] });
    }),

    addNodeAtPosition: withHistory(
      (position, shape: NodeShape = "rectangle", width?: number, height?: number) => {
        const id = `node_${nodeCounter++}`;
        const newNode: Node<FlowNodeData> = {
          id,
          type: "flowNode",
          position,
          data: { label: "Node", shape },
          ...(width && height ? { style: { width, height } } : {}),
        };
        set({ nodes: [...get().nodes, newNode] });
      },
    ),

    updateNodeLabel: withHistory((id, label) => {
      set({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, label } } : n,
        ),
      });
    }),

    updateNodeShape: withHistory((id, shape) => {
      set({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, shape } } : n,
        ),
      });
    }),

    updateNodeStyle: withHistory((id, style) => {
      set({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...style } } : n,
        ),
      });
    }),

    updateEdgeLabel: withHistory((id, label) => {
      set({
        edges: get().edges.map((e) => (e.id === id ? { ...e, label } : e)),
      });
    }),

    updateEdgeType: withHistory((id, updates) => {
      const arrowType = updates.arrowType;
      const markerUpdates =
        arrowType !== undefined ? computeMarkers(arrowType) : {};
      set({
        edges: get().edges.map((e) => {
          if (e.id !== id) return e
          const updated = {
            ...e,
            data: { ...(e.data ?? {}), ...updates } as FlowEdgeData,
          } as Edge<FlowEdgeData>
          if (arrowType === 'none') {
            delete (updated as Record<string, unknown>).markerEnd
            delete (updated as Record<string, unknown>).markerStart
          } else if (arrowType === 'bidirectional') {
            updated.markerEnd = markerUpdates.markerEnd
            updated.markerStart = markerUpdates.markerStart
          } else {
            updated.markerEnd = markerUpdates.markerEnd
            delete (updated as Record<string, unknown>).markerStart
          }
          return updated
        }),
      });
    }),

    setNodes: withHistory((nodes) => {
      set({ nodes });
    }),

    loadDiagram: withHistory((nodes, edges) => {
      const stampedNodes = nodes.map((n) => ({ ...n, type: "flowNode" }));
      const stampedEdges = edges.map((e) => ({
        ...e,
        type: "flowEdge",
      })) as Edge<FlowEdgeData>[];
      const maxId = stampedNodes.reduce((max, n) => {
        const m = n.id.match(/(\d+)$/)
        return m ? Math.max(max, parseInt(m[1], 10)) : max
      }, 0)
      if (maxId >= nodeCounter) nodeCounter = maxId + 1
      set({ nodes: stampedNodes, edges: stampedEdges });
    }),

    importDiagram: withHistory((nodes, edges, settings) => {
      const stampedNodes = nodes.map((n) => ({ ...n, type: "flowNode" }));
      const stampedEdges = edges.map((e) => ({
        ...e,
        type: "flowEdge",
      })) as Edge<FlowEdgeData>[];
      // Advance nodeCounter to avoid ID collisions with imported nodes
      const maxId = stampedNodes.reduce((max, n) => {
        const m = n.id.match(/(\d+)$/)
        return m ? Math.max(max, parseInt(m[1], 10)) : max
      }, 0)
      if (maxId >= nodeCounter) nodeCounter = maxId + 1
      set({
        nodes: stampedNodes,
        edges: stampedEdges,
        direction: settings.direction,
        theme: settings.theme,
        look: settings.look,
        curveStyle: settings.curveStyle,
      });
    }),

    addSubgraph: withHistory((title = "Group") => {
      const id = `sg_${nodeCounter++}`;
      const offset = (nodeCounter * 30) % 200;
      const newNode: Node<FlowNodeData> = {
        id,
        type: "flowNode",
        position: { x: 200 + offset, y: 150 + offset },
        data: { label: title, shape: "rectangle", isSubgraph: true },
        style: { width: 320, height: 220 },
        zIndex: -1,
      };
      set({ nodes: [...get().nodes, newNode] });
    }),

    assignToSubgraph: withHistory((nodeIds, subgraphId) => {
      const { nodes } = get();
      set({
        nodes: nodes.map((n) => {
          if (!nodeIds.includes(n.id)) return n;
          if (subgraphId === null) {
            // Remove from subgraph: restore absolute position
            const parent = n.parentId ? nodes.find((p) => p.id === n.parentId) : null;
            const absPos = parent
              ? { x: parent.position.x + n.position.x, y: parent.position.y + n.position.y }
              : n.position;
            return { ...n, parentId: undefined, extent: undefined, position: absPos };
          }
          // Assign to subgraph: convert to relative position
          const parent = nodes.find((p) => p.id === subgraphId);
          const relPos = parent
            ? { x: n.position.x - parent.position.x, y: n.position.y - parent.position.y }
            : n.position;
          return { ...n, parentId: subgraphId, position: relPos };
        }),
      });
    }),

    setDirection: (direction) => set({ direction }),
    setTheme: (theme) => set({ theme }),
    setLook: (look) => set({ look }),
    setCurveStyle: (curveStyle) => set({ curveStyle }),

    copySelected: () => {
      const { nodes, edges } = get();
      const selectedNodes = nodes.filter((n) => n.selected);
      if (selectedNodes.length === 0) return;
      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      const selectedEdges = edges.filter(
        (e) => selectedIds.has(e.source) && selectedIds.has(e.target),
      );
      set({ clipboard: { nodes: selectedNodes, edges: selectedEdges } });
    },

    pasteClipboard: withHistory(() => {
      const { clipboard, nodes, edges } = get();
      if (!clipboard || clipboard.nodes.length === 0) return;

      const idMap = new Map<string, string>();

      const newNodes = clipboard.nodes.map((n) => {
        const newId = `node_${nodeCounter++}`;
        idMap.set(n.id, newId);
        return {
          ...n,
          id: newId,
          selected: true,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
          parentId: n.parentId && idMap.has(n.parentId) ? idMap.get(n.parentId) : undefined,
        };
      });

      const newEdges = clipboard.edges
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e) => ({
          ...e,
          id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
          selected: true,
        }));

      set({
        nodes: [...nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
        edges: [...edges.map((e) => ({ ...e, selected: false })), ...newEdges],
      });
    }),

    duplicateSelected: withHistory(() => {
      const { nodes, edges } = get();
      const selectedNodes = nodes.filter((n) => n.selected);
      if (selectedNodes.length === 0) return;
      const idMap = new Map<string, string>();

      const newNodes = selectedNodes.map((n) => {
        const newId = `node_${nodeCounter++}`;
        idMap.set(n.id, newId);
        const label = n.data.isSubgraph ? `Copy of ${n.data.label}` : n.data.label;
        return {
          ...n,
          id: newId,
          data: { ...n.data, label },
          position: { x: n.position.x + 30, y: n.position.y + 30 },
          selected: true,
        };
      });

      const childNodes: Node<FlowNodeData>[] = [];
      for (const n of selectedNodes) {
        if (!n.data.isSubgraph) continue;
        const newParentId = idMap.get(n.id)!;
        for (const child of nodes.filter((c) => c.parentId === n.id)) {
          const newChildId = `node_${nodeCounter++}`;
          idMap.set(child.id, newChildId);
          childNodes.push({ ...child, id: newChildId, parentId: newParentId, selected: true });
        }
      }

      const newEdges = edges
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e) => ({
          ...e,
          id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
        }));

      set({
        nodes: [...nodes.map((n) => ({ ...n, selected: false })), ...newNodes, ...childNodes],
        edges: [...edges, ...newEdges],
      });
    }),
  };
});

const AUTOSAVE_KEY = 'mermaid-visual-editor-autosave'
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

export function startAutoSave(): () => void {
  return useFlowStore.subscribe((state) => {
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => {
      if (state.nodes.length === 0) return
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
          nodes: state.nodes,
          edges: state.edges,
          direction: state.direction,
          theme: state.theme,
          look: state.look,
          curveStyle: state.curveStyle,
          timestamp: Date.now(),
        }))
      } catch { /* localStorage unavailable */ }
    }, 2000)
  })
}

export function loadAutoSave(): { nodes: Node<FlowNodeData>[]; edges: Edge<FlowEdgeData>[] } | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function hasAutoSave(): boolean {
  return localStorage.getItem(AUTOSAVE_KEY) !== null
}

export function clearAutoSave(): void {
  localStorage.removeItem(AUTOSAVE_KEY)
}
