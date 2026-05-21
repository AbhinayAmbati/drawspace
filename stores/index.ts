'use client';

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type {
  DrawingTool,
  StrokeStyle,
  FillStyle,
  CanvasViewport,
  GridSettings,
  CanvasSettings,
  CanvasObject,
  Layer,
} from '@/types';

// ============================================================
// Tool Store — current tool & style settings
// ============================================================

interface ToolState {
  activeTool: DrawingTool;
  stroke: StrokeStyle;
  fill: FillStyle;
  fontSize: number;
  fontFamily: string;
  setActiveTool: (tool: DrawingTool) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setStrokeOpacity: (opacity: number) => void;
  setStrokeDash: (dashArray: number[]) => void;
  setFillColor: (color: string) => void;
  setFillOpacity: (opacity: number) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
}

export const useToolStore = create<ToolState>()(
  devtools(
    persist(
      (set) => ({
        activeTool: 'select',
        stroke: { color: '#1e1e1e', width: 2, opacity: 1 },
        fill: { color: 'transparent', opacity: 1 },
        fontSize: 20,
        fontFamily: 'Inter',
        setActiveTool: (tool) => set({ activeTool: tool }),
        setStrokeColor: (color) =>
          set((s) => ({ stroke: { ...s.stroke, color } })),
        setStrokeWidth: (width) =>
          set((s) => ({ stroke: { ...s.stroke, width } })),
        setStrokeOpacity: (opacity) =>
          set((s) => ({ stroke: { ...s.stroke, opacity } })),
        setStrokeDash: (dashArray) =>
          set((s) => ({ stroke: { ...s.stroke, dashArray } })),
        setFillColor: (color) =>
          set((s) => ({ fill: { ...s.fill, color } })),
        setFillOpacity: (opacity) =>
          set((s) => ({ fill: { ...s.fill, opacity } })),
        setFontSize: (size) => set({ fontSize: size }),
        setFontFamily: (family) => set({ fontFamily: family }),
      }),
      { name: 'drawspace-tool' }
    ),
    { name: 'ToolStore' }
  )
);

// ============================================================
// Canvas Store — viewport, settings, grid
// ============================================================

interface CanvasState {
  viewport: CanvasViewport;
  settings: CanvasSettings;
  setViewport: (viewport: Partial<CanvasViewport>) => void;
  setZoom: (zoom: number) => void;
  resetViewport: () => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  toggleRulers: () => void;
  setGridSize: (size: number) => void;
  setBackgroundColor: (color: string) => void;
  updateGridSettings: (settings: Partial<GridSettings>) => void;
}

const DEFAULT_VIEWPORT: CanvasViewport = { zoom: 1, panX: 0, panY: 0 };
const DEFAULT_SETTINGS: CanvasSettings = {
  backgroundColor: '#ffffff',
  grid: { enabled: false, size: 20, snapToGrid: false, showGuides: true },
  showRulers: false,
  retina: true,
};

export const useCanvasStore = create<CanvasState>()(
  devtools(
    persist(
      (set) => ({
        viewport: { ...DEFAULT_VIEWPORT },
        settings: { ...DEFAULT_SETTINGS },
        setViewport: (vp) =>
          set((s) => ({ viewport: { ...s.viewport, ...vp } })),
        setZoom: (zoom) =>
          set((s) => ({ viewport: { ...s.viewport, zoom: Math.max(0.1, Math.min(5, zoom)) } })),
        resetViewport: () => set({ viewport: { ...DEFAULT_VIEWPORT } }),
        toggleGrid: () =>
          set((s) => ({
            settings: {
              ...s.settings,
              grid: { ...s.settings.grid, enabled: !s.settings.grid.enabled },
            },
          })),
        toggleSnapToGrid: () =>
          set((s) => ({
            settings: {
              ...s.settings,
              grid: { ...s.settings.grid, snapToGrid: !s.settings.grid.snapToGrid },
            },
          })),
        toggleRulers: () =>
          set((s) => ({
            settings: { ...s.settings, showRulers: !s.settings.showRulers },
          })),
        setGridSize: (size) =>
          set((s) => ({
            settings: { ...s.settings, grid: { ...s.settings.grid, size } },
          })),
        setBackgroundColor: (backgroundColor) =>
          set((s) => ({ settings: { ...s.settings, backgroundColor } })),
        updateGridSettings: (gridUpdate) =>
          set((s) => ({
            settings: {
              ...s.settings,
              grid: { ...s.settings.grid, ...gridUpdate },
            },
          })),
      }),
      { name: 'drawspace-canvas' }
    ),
    { name: 'CanvasStore' }
  )
);

// ============================================================
// Objects Store — canvas objects, selection, layers
// ============================================================

interface ObjectsState {
  objects: Map<string, CanvasObject>;
  selectedIds: Set<string>;
  layers: Layer[];
  activeLayerId: string;

  // Object CRUD
  addObject: (obj: CanvasObject) => void;
  addObjects: (objs: CanvasObject[]) => void;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  removeObject: (id: string) => void;
  removeObjects: (ids: string[]) => void;
  clearObjects: () => void;
  setObjects: (objects: CanvasObject[]) => void;

  // Selection
  selectObject: (id: string) => void;
  selectObjects: (ids: string[]) => void;
  deselectAll: () => void;
  toggleSelection: (id: string) => void;

  // Layers
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  setActiveLayer: (id: string) => void;
  reorderLayers: (layers: Layer[]) => void;

  // Ordering
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // Lock
  toggleLock: (id: string) => void;
}

const DEFAULT_LAYER: Layer = {
  id: 'default',
  name: 'Layer 1',
  visible: true,
  locked: false,
  opacity: 1,
  objectIds: [],
  order: 0,
};

export const useObjectsStore = create<ObjectsState>()(
  devtools(
    (set, get) => ({
      objects: new Map(),
      selectedIds: new Set(),
      layers: [{ ...DEFAULT_LAYER }],
      activeLayerId: 'default',

      addObject: (obj) =>
        set((s) => {
          const objects = new Map(s.objects);
          objects.set(obj.id, obj);
          const layers = s.layers.map((l) =>
            l.id === s.activeLayerId
              ? { ...l, objectIds: [...l.objectIds, obj.id] }
              : l
          );
          return { objects, layers };
        }),
      addObjects: (objs) =>
        set((s) => {
          const objects = new Map(s.objects);
          const newIds: string[] = [];
          objs.forEach((obj) => {
            objects.set(obj.id, obj);
            newIds.push(obj.id);
          });
          const layers = s.layers.map((l) =>
            l.id === s.activeLayerId
              ? { ...l, objectIds: [...l.objectIds, ...newIds] }
              : l
          );
          return { objects, layers };
        }),
      updateObject: (id, updates) =>
        set((s) => {
          const objects = new Map(s.objects);
          const existing = objects.get(id);
          if (existing) {
            objects.set(id, { ...existing, ...updates, updatedAt: Date.now() });
          }
          return { objects };
        }),
      removeObject: (id) =>
        set((s) => {
          const objects = new Map(s.objects);
          objects.delete(id);
          const selectedIds = new Set(s.selectedIds);
          selectedIds.delete(id);
          const layers = s.layers.map((l) => ({
            ...l,
            objectIds: l.objectIds.filter((oid) => oid !== id),
          }));
          return { objects, selectedIds, layers };
        }),
      removeObjects: (ids) =>
        set((s) => {
          const objects = new Map(s.objects);
          const selectedIds = new Set(s.selectedIds);
          const idSet = new Set(ids);
          ids.forEach((id) => {
            objects.delete(id);
            selectedIds.delete(id);
          });
          const layers = s.layers.map((l) => ({
            ...l,
            objectIds: l.objectIds.filter((oid) => !idSet.has(oid)),
          }));
          return { objects, selectedIds, layers };
        }),
      clearObjects: () =>
        set({
          objects: new Map(),
          selectedIds: new Set(),
          layers: [{ ...DEFAULT_LAYER }],
        }),
      setObjects: (objs) =>
        set(() => {
          const objects = new Map<string, CanvasObject>();
          objs.forEach((obj) => objects.set(obj.id, obj));
          return { objects };
        }),

      selectObject: (id) => set({ selectedIds: new Set([id]) }),
      selectObjects: (ids) => set({ selectedIds: new Set(ids) }),
      deselectAll: () => set({ selectedIds: new Set() }),
      toggleSelection: (id) =>
        set((s) => {
          const selectedIds = new Set(s.selectedIds);
          if (selectedIds.has(id)) selectedIds.delete(id);
          else selectedIds.add(id);
          return { selectedIds };
        }),

      addLayer: (layer) =>
        set((s) => ({ layers: [...s.layers, layer] })),
      removeLayer: (id) =>
        set((s) => ({
          layers: s.layers.filter((l) => l.id !== id),
          activeLayerId: s.activeLayerId === id ? s.layers[0]?.id ?? 'default' : s.activeLayerId,
        })),
      updateLayer: (id, updates) =>
        set((s) => ({
          layers: s.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        })),
      setActiveLayer: (id) => set({ activeLayerId: id }),
      reorderLayers: (layers) => set({ layers }),

      bringForward: (id) =>
        set((s) => {
          const obj = s.objects.get(id);
          if (!obj) return s;
          const maxOrder = Math.max(...Array.from(s.objects.values()).map((o) => o.layerOrder));
          if (obj.layerOrder >= maxOrder) return s;
          const objects = new Map(s.objects);
          objects.set(id, { ...obj, layerOrder: obj.layerOrder + 1 });
          return { objects };
        }),
      sendBackward: (id) =>
        set((s) => {
          const obj = s.objects.get(id);
          if (!obj || obj.layerOrder <= 0) return s;
          const objects = new Map(s.objects);
          objects.set(id, { ...obj, layerOrder: obj.layerOrder - 1 });
          return { objects };
        }),
      bringToFront: (id) =>
        set((s) => {
          const obj = s.objects.get(id);
          if (!obj) return s;
          const maxOrder = Math.max(...Array.from(s.objects.values()).map((o) => o.layerOrder));
          const objects = new Map(s.objects);
          objects.set(id, { ...obj, layerOrder: maxOrder + 1 });
          return { objects };
        }),
      sendToBack: (id) =>
        set((s) => {
          const obj = s.objects.get(id);
          if (!obj) return s;
          const objects = new Map(s.objects);
          // Shift all objects up and place this one at 0
          objects.forEach((o, key) => {
            if (key !== id) objects.set(key, { ...o, layerOrder: o.layerOrder + 1 });
          });
          objects.set(id, { ...obj, layerOrder: 0 });
          return { objects };
        }),

      toggleLock: (id) =>
        set((s) => {
          const obj = s.objects.get(id);
          if (!obj) return s;
          const objects = new Map(s.objects);
          objects.set(id, { ...obj, locked: !obj.locked });
          return { objects };
        }),
    }),
    { name: 'ObjectsStore' }
  )
);

// ============================================================
// History Store — undo / redo
// ============================================================

interface HistoryState {
  undoStack: string[]; // Serialized snapshots
  redoStack: string[];
  maxHistory: number;
  canUndo: boolean;
  canRedo: boolean;
  pushState: (snapshot: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  devtools(
    (set, get) => ({
      undoStack: [],
      redoStack: [],
      maxHistory: 50,
      canUndo: false,
      canRedo: false,
      pushState: (snapshot) =>
        set((s) => {
          const undoStack = [...s.undoStack, snapshot].slice(-s.maxHistory);
          return { undoStack, redoStack: [], canUndo: true, canRedo: false };
        }),
      undo: () => {
        const s = get();
        if (s.undoStack.length === 0) return null;
        const undoStack = [...s.undoStack];
        const snapshot = undoStack.pop()!;
        const redoStack = [...s.redoStack, snapshot];
        set({
          undoStack,
          redoStack,
          canUndo: undoStack.length > 0,
          canRedo: true,
        });
        return undoStack[undoStack.length - 1] ?? null;
      },
      redo: () => {
        const s = get();
        if (s.redoStack.length === 0) return null;
        const redoStack = [...s.redoStack];
        const snapshot = redoStack.pop()!;
        const undoStack = [...s.undoStack, snapshot];
        set({
          undoStack,
          redoStack,
          canUndo: true,
          canRedo: redoStack.length > 0,
        });
        return snapshot;
      },
      clear: () =>
        set({ undoStack: [], redoStack: [], canUndo: false, canRedo: false }),
    }),
    { name: 'HistoryStore' }
  )
);

// ============================================================
// Collaboration Store
// ============================================================

interface CollaborationState {
  roomId: string | null;
  userId: string;
  userName: string;
  userColor: string;
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  collaborators: Map<string, { id: string; name: string; color: string; cursor: { x: number; y: number } }>;

  setRoom: (roomId: string) => void;
  setUser: (userId: string, userName: string, userColor: string) => void;
  setConnectionStatus: (status: CollaborationState['connectionStatus']) => void;
  updateCursor: (userId: string, x: number, y: number) => void;
  addCollaborator: (id: string, name: string, color: string) => void;
  removeCollaborator: (id: string) => void;
  clearCollaborators: () => void;
}

const CURSOR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f43f5e', '#a855f7', '#6366f1',
];

export const useCollaborationStore = create<CollaborationState>()(
  devtools(
    (set) => ({
      roomId: null,
      userId: '',
      userName: 'Anonymous',
      userColor: CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)],
      isConnected: false,
      connectionStatus: 'disconnected',
      collaborators: new Map(),

      setRoom: (roomId) => set({ roomId }),
      setUser: (userId, userName, userColor) =>
        set({ userId, userName, userColor }),
      setConnectionStatus: (status) =>
        set({ connectionStatus: status, isConnected: status === 'connected' }),
      updateCursor: (userId, x, y) =>
        set((s) => {
          const collaborators = new Map(s.collaborators);
          const existing = collaborators.get(userId);
          if (existing) {
            collaborators.set(userId, { ...existing, cursor: { x, y } });
          }
          return { collaborators };
        }),
      addCollaborator: (id, name, color) =>
        set((s) => {
          const collaborators = new Map(s.collaborators);
          collaborators.set(id, { id, name, color, cursor: { x: 0, y: 0 } });
          return { collaborators };
        }),
      removeCollaborator: (id) =>
        set((s) => {
          const collaborators = new Map(s.collaborators);
          collaborators.delete(id);
          return { collaborators };
        }),
      clearCollaborators: () => set({ collaborators: new Map() }),
    }),
    { name: 'CollaborationStore' }
  )
);

// ============================================================
// UI Store — panels, modals, etc.
// ============================================================

interface UIState {
  showProperties: boolean;
  showLayers: boolean;
  showMinimap: boolean;
  showExportDialog: boolean;
  showShareDialog: boolean;
  showSettingsDialog: boolean;
  isMobileToolbarOpen: boolean;
  sidebarWidth: number;

  toggleProperties: () => void;
  toggleLayers: () => void;
  toggleMinimap: () => void;
  setShowExportDialog: (show: boolean) => void;
  setShowShareDialog: (show: boolean) => void;
  setShowSettingsDialog: (show: boolean) => void;
  setMobileToolbarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        showProperties: false,
        showLayers: false,
        showMinimap: false,
        showExportDialog: false,
        showShareDialog: false,
        showSettingsDialog: false,
        isMobileToolbarOpen: false,
        sidebarWidth: 260,

        toggleProperties: () => set((s) => ({ showProperties: !s.showProperties })),
        toggleLayers: () => set((s) => ({ showLayers: !s.showLayers })),
        toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
        setShowExportDialog: (show) => set({ showExportDialog: show }),
        setShowShareDialog: (show) => set({ showShareDialog: show }),
        setShowSettingsDialog: (show) => set({ showSettingsDialog: show }),
        setMobileToolbarOpen: (open) => set({ isMobileToolbarOpen: open }),
        setSidebarWidth: (width) => set({ sidebarWidth: width }),
      }),
      { name: 'drawspace-ui' }
    ),
    { name: 'UIStore' }
  )
);
