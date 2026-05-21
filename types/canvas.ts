// ============================================================
// Canvas & Drawing Types
// ============================================================

export type DrawingTool =
  | 'select'
  | 'pencil'
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'text'
  | 'sticky'
  | 'image'
  | 'eraser';

export interface Point {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CanvasViewport {
  zoom: number;
  panX: number;
  panY: number;
}

// ============================================================
// Object / Element Types
// ============================================================

export interface StrokeStyle {
  color: string;
  width: number;
  dashArray?: number[];
  opacity: number;
}

export interface FillStyle {
  color: string;
  opacity: number;
}

export interface ShadowStyle {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface FontStyle {
  family: string;
  size: number;
  weight: number;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
}

export interface CanvasObject {
  id: string;
  type: DrawingTool;
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  stroke: StrokeStyle;
  fill: FillStyle;
  shadow?: ShadowStyle;
  font?: FontStyle;
  locked: boolean;
  visible: boolean;
  layerOrder: number;
  groupId?: string;
  /** Serialized fabric.js object data */
  fabricData?: Record<string, unknown>;
  /** Text content for text/sticky note objects */
  text?: string;
  /** Path data for freehand drawings */
  path?: string;
  /** Image source URL */
  imageSrc?: string;
  /** Arrow head config */
  arrowHead?: {
    start: boolean;
    end: boolean;
  };
  /** Created timestamp */
  createdAt: number;
  /** Last modified timestamp */
  updatedAt: number;
  /** User who created this object */
  createdBy?: string;
}

// ============================================================
// History Types
// ============================================================

export type HistoryActionType = 'add' | 'remove' | 'modify' | 'batch';

export interface HistoryEntry {
  id: string;
  type: HistoryActionType;
  timestamp: number;
  /** Objects before the action */
  before: Partial<CanvasObject>[];
  /** Objects after the action */
  after: Partial<CanvasObject>[];
  /** Batch of child actions */
  children?: HistoryEntry[];
}

// ============================================================
// Layer Types
// ============================================================

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  objectIds: string[];
  order: number;
}

// ============================================================
// Collaboration Types
// ============================================================

export interface CollaboratorCursor {
  id: string;
  name: string;
  color: string;
  position: Point;
  /** Currently selected object IDs */
  selectedIds: string[];
  /** Whether the user is currently active */
  isActive: boolean;
  /** Last activity timestamp */
  lastActive: number;
}

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  isOnline: boolean;
  joinedAt: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface RoomState {
  roomId: string;
  roomName: string;
  isPublic: boolean;
  ownerId: string;
  users: CollaborationUser[];
  cursors: Map<string, CollaboratorCursor>;
  connectionStatus: ConnectionStatus;
}

// ============================================================
// Board / Whiteboard Types
// ============================================================

export interface BoardMetadata {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  isPublic: boolean;
  tags?: string[];
  collaboratorIds?: string[];
}

export interface BoardSnapshot {
  id: string;
  boardId: string;
  version: number;
  objects: CanvasObject[];
  layers: Layer[];
  viewport: CanvasViewport;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface Board {
  metadata: BoardMetadata;
  snapshot: BoardSnapshot;
}

// ============================================================
// UI State Types
// ============================================================

export interface GridSettings {
  enabled: boolean;
  size: number;
  snapToGrid: boolean;
  showGuides: boolean;
}

export interface CanvasSettings {
  backgroundColor: string;
  grid: GridSettings;
  showRulers: boolean;
  retina: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultStroke: StrokeStyle;
  defaultFill: FillStyle;
  showMinimap: boolean;
  cursorLabel: boolean;
  autoSave: boolean;
  autoSaveInterval: number; // milliseconds
}

// ============================================================
// Export Types
// ============================================================

export type ExportFormat = 'png' | 'svg' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  quality?: number;
  scale?: number;
  background?: boolean;
  selectedOnly?: boolean;
}

// ============================================================
// API Types
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
