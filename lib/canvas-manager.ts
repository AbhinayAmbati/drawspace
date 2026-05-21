/**
 * Canvas Manager — wraps Fabric.js canvas and provides the core
 * drawing, pan/zoom, and object manipulation API.
 *
 * This is a singleton-style class instantiated once per whiteboard view.
 */

import * as fabric from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import type { CanvasObject, DrawingTool, StrokeStyle, FillStyle, Point } from '@/types';

// ============================================================
// Helpers
// ============================================================

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.05;

/** Snap value to nearest grid increment */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Generate a deterministic user color from a string */
export function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

// ============================================================
// Canvas Manager
// ============================================================

export class CanvasManager {
  canvas: fabric.Canvas | null = null;
  private isPanning = false;
  private lastPanPoint: Point = { x: 0, y: 0 };
  private gridGroup: fabric.Group | null = null;

  // Callbacks for store integration
  onObjectAdded?: (obj: CanvasObject) => void;
  onObjectModified?: (obj: CanvasObject) => void;
  onObjectRemoved?: (id: string) => void;
  onSelectionChanged?: (ids: string[]) => void;
  onViewportChanged?: (zoom: number, panX: number, panY: number) => void;


  // ── Selection styling constants ──────────────────────────
  private static readonly SELECTION_STYLE = {
    transparentCorners: false,
    cornerColor: '#4f46e5',          // indigo-600
    cornerStrokeColor: '#ffffff',
    cornerSize: 8,
    cornerStyle: 'circle' as const,
    borderColor: '#6366f1',          // indigo-500
    borderDashArray: [4, 3],
    borderScaleFactor: 1.5,
    padding: 4,
  };

  /** Stamp modern selection styling onto a single Fabric object. */
  private _applySelectionStyle(obj: fabric.FabricObject) {
    obj.set(CanvasManager.SELECTION_STYLE as any);
  }

  /**
   * Initialize the Fabric.js canvas on a given HTML canvas element.
   */
  init(canvasEl: HTMLCanvasElement, width: number, height: number) {
    this.canvas = new fabric.Canvas(canvasEl, {
      width,
      height,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
      enableRetinaScaling: true,
    });

    // Canvas-level multi-selection rectangle
    this.canvas.selectionColor = 'rgba(99, 102, 241, 0.08)';
    this.canvas.selectionBorderColor = '#6366f1';
    this.canvas.selectionLineWidth = 1.5;

    this._setupEventListeners();
    return this.canvas;
  }

  destroy() {
    if (this.canvas) {
      this.canvas.dispose();
      this.canvas = null;
    }
  }

  resize(width: number, height: number) {
    if (!this.canvas) return;
    this.canvas.setDimensions({ width, height });
    this.canvas.renderAll();
  }

  // ============================================================
  // Viewport / Pan / Zoom
  // ============================================================

  getZoom(): number {
    return this.canvas?.getZoom() ?? 1;
  }

  setZoom(zoom: number, center?: Point) {
    if (!this.canvas) return;
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
    if (center) {
      this.canvas.zoomToPoint(new fabric.Point(center.x, center.y), clamped);
    } else {
      this.canvas.setZoom(clamped);
    }
    this._emitViewportChange();
    this.canvas.requestRenderAll();
  }

  zoomIn(center?: Point) {
    this.setZoom(this.getZoom() + ZOOM_STEP * 2, center);
  }

  zoomOut(center?: Point) {
    this.setZoom(this.getZoom() - ZOOM_STEP * 2, center);
  }

  zoomToFit() {
    if (!this.canvas) return;
    const objects = this.canvas.getObjects();
    if (objects.length === 0) {
      this.resetView();
      return;
    }

    // Calculate bounding box of all objects
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach((obj) => {
      const bound = obj.getBoundingRect();
      minX = Math.min(minX, bound.left);
      minY = Math.min(minY, bound.top);
      maxX = Math.max(maxX, bound.left + bound.width);
      maxY = Math.max(maxY, bound.top + bound.height);
    });

    const padding = 60;
    const bw = maxX - minX + padding * 2;
    const bh = maxY - minY + padding * 2;
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    const zoom = Math.min(cw / bw, ch / bh, 1);
    
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.canvas.setZoom(zoom);
    const vpt = this.canvas.viewportTransform!;
    vpt[4] = (cw - bw * zoom) / 2 - minX * zoom + padding * zoom;
    vpt[5] = (ch - bh * zoom) / 2 - minY * zoom + padding * zoom;
    this.canvas.setViewportTransform(vpt);
    this._emitViewportChange();
    this.canvas.requestRenderAll();
  }

  resetView() {
    if (!this.canvas) return;
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this._emitViewportChange();
    this.canvas.requestRenderAll();
  }

  panTo(x: number, y: number) {
    if (!this.canvas) return;
    const vpt = this.canvas.viewportTransform!;
    vpt[4] = x;
    vpt[5] = y;
    this.canvas.setViewportTransform(vpt);
    this._emitViewportChange();
    this.canvas.requestRenderAll();
  }

  // ============================================================
  // Drawing — Create objects
  // ============================================================

  addRectangle(
    left: number, top: number, width: number, height: number,
    stroke: StrokeStyle, fill: FillStyle
  ): string {
    if (!this.canvas) return '';
    const id = uuidv4();
    const rect = new fabric.Rect({
      left, top, width, height,
      stroke: stroke.color,
      strokeWidth: stroke.width,
      strokeDashArray: stroke.dashArray,
      fill: fill.color === 'transparent' ? 'transparent' : fill.color,
      opacity: fill.opacity,
      rx: 8, ry: 8,
    });
    (rect as any).__objectId = id;
    this._applySelectionStyle(rect);
    this.canvas.add(rect);
    this.canvas.requestRenderAll();
    this._emitObjectAdded(rect, id);
    return id;
  }

  addCircle(
    left: number, top: number, radius: number,
    stroke: StrokeStyle, fill: FillStyle
  ): string {
    if (!this.canvas) return '';
    const id = uuidv4();
    const circle = new fabric.Circle({
      left, top, radius,
      stroke: stroke.color,
      strokeWidth: stroke.width,
      strokeDashArray: stroke.dashArray,
      fill: fill.color === 'transparent' ? 'transparent' : fill.color,
      opacity: fill.opacity,
    });
    (circle as any).__objectId = id;
    this._applySelectionStyle(circle);
    this.canvas.add(circle);
    this.canvas.requestRenderAll();
    this._emitObjectAdded(circle, id);
    return id;
  }

  addEllipse(
    left: number, top: number, rx: number, ry: number,
    stroke: StrokeStyle, fill: FillStyle
  ): string {
    if (!this.canvas) return '';
    const id = uuidv4();
    const ellipse = new fabric.Ellipse({
      left, top, rx, ry,
      stroke: stroke.color,
      strokeWidth: stroke.width,
      strokeDashArray: stroke.dashArray,
      fill: fill.color === 'transparent' ? 'transparent' : fill.color,
      opacity: fill.opacity,
    });
    (ellipse as any).__objectId = id;
    this._applySelectionStyle(ellipse);
    this.canvas.add(ellipse);
    this.canvas.requestRenderAll();
    this._emitObjectAdded(ellipse, id);
    return id;
  }

  addDiamond(
    left: number, top: number, size: number,
    stroke: StrokeStyle, fill: FillStyle
  ): string {
    if (!this.canvas) return '';
    const id = uuidv4();
    const half = size / 2;
    const points = [
      { x: half, y: 0 },
      { x: size, y: half },
      { x: half, y: size },
      { x: 0, y: half },
    ];
    const diamond = new fabric.Polygon(points, {
      left, top,
      stroke: stroke.color,
      strokeWidth: stroke.width,
      strokeDashArray: stroke.dashArray,
      fill: fill.color === 'transparent' ? 'transparent' : fill.color,
      opacity: fill.opacity,
    });
    (diamond as any).__objectId = id;
    this._applySelectionStyle(diamond);
    this.canvas.add(diamond);
    this.canvas.requestRenderAll();
    this._emitObjectAdded(diamond, id);
    return id;
  }

  addLine(
    x1: number, y1: number, x2: number, y2: number,
    stroke: StrokeStyle
  ): string {
    if (!this.canvas) return '';
    const id = uuidv4();
    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: stroke.color,
      strokeWidth: stroke.width,
      strokeDashArray: stroke.dashArray,
    });
    (line as any).__objectId = id;
    this._applySelectionStyle(line);
    this.canvas.add(line);
    this.canvas.requestRenderAll();
    this._emitObjectAdded(line, id);
    return id;
  }

  addArrow(
    x1: number, y1: number, x2: number, y2: number,
    stroke: StrokeStyle
  ): string {
    if (!this.canvas) return '';
    const id = uuidv4();

    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: stroke.color,
      strokeWidth: stroke.width,
      strokeDashArray: stroke.dashArray,
    });

    // Arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 15;
    const headAngle = Math.PI / 6;

    const arrowHead = new fabric.Polygon([
      { x: x2, y: y2 },
      {
        x: x2 - headLen * Math.cos(angle - headAngle),
        y: y2 - headLen * Math.sin(angle - headAngle),
      },
      {
        x: x2 - headLen * Math.cos(angle + headAngle),
        y: y2 - headLen * Math.sin(angle + headAngle),
      },
    ], {
      fill: stroke.color,
      stroke: stroke.color,
      strokeWidth: 1,
    });

    const group = new fabric.Group([line, arrowHead], {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
    });
    (group as any).__objectId = id;
    this._applySelectionStyle(group);
    this.canvas.add(group);
    this.canvas.requestRenderAll();
    this._emitObjectAdded(group, id);
    return id;
  }

  addText(
    left: number, top: number, text: string,
    fontSize: number, fontFamily: string, stroke: StrokeStyle
  ): string {
    if (!this.canvas) return '';
    const id = uuidv4();
    const itext = new fabric.IText(text, {
      left, top,
      fontSize,
      fontFamily,
      fill: stroke.color,
      editable: true,
    });
    (itext as any).__objectId = id;
    this._applySelectionStyle(itext);
    this.canvas.add(itext);
    this.canvas.setActiveObject(itext);
    itext.enterEditing();
    this.canvas.requestRenderAll();
    this._emitObjectAdded(itext, id);
    return id;
  }

  addStickyNote(
    left: number, top: number,
    stroke: StrokeStyle
  ): string {
    if (!this.canvas) return '';
    const id = uuidv4();
    const noteColors = ['#fff9c4', '#c8e6c9', '#bbdefb', '#f8bbd0', '#e1bee7', '#ffe0b2'];
    const bgColor = noteColors[Math.floor(Math.random() * noteColors.length)];

    const rect = new fabric.Rect({
      width: 200,
      height: 200,
      fill: bgColor,
      rx: 4,
      ry: 4,
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.15)',
        blur: 10,
        offsetX: 2,
        offsetY: 4,
      }),
    });

    const text = new fabric.IText('Type here...', {
      fontSize: 16,
      fontFamily: 'Inter',
      fill: '#333333',
      left: 16,
      top: 16,
      width: 168,
      editable: true,
    });

    const group = new fabric.Group([rect, text], {
      left, top,
      subTargetCheck: true,
    });
    (group as any).__objectId = id;
    this._applySelectionStyle(group);
    this.canvas.add(group);
    this.canvas.requestRenderAll();
    this._emitObjectAdded(group, id);
    return id;
  }

  // ============================================================
  // Freehand Drawing (Pencil)
  // ============================================================

  enableFreeDrawing(stroke: StrokeStyle) {
    if (!this.canvas) return;
    this.canvas.isDrawingMode = true;
    const brush = new fabric.PencilBrush(this.canvas);
    brush.color = stroke.color;
    brush.width = stroke.width;
    this.canvas.freeDrawingBrush = brush;
  }

  disableFreeDrawing() {
    if (!this.canvas) return;
    this.canvas.isDrawingMode = false;
  }

  // ============================================================
  // Eraser
  // ============================================================

  enableEraser() {
    if (!this.canvas) return;
    // Use a thick white brush as a simple eraser
    this.canvas.isDrawingMode = true;
    const brush = new fabric.PencilBrush(this.canvas);
    brush.color = '#ffffff';
    brush.width = 20;
    this.canvas.freeDrawingBrush = brush;
  }

  // ============================================================
  // Selection & Manipulation
  // ============================================================

  selectAll() {
    if (!this.canvas) return;
    const objects = this.canvas.getObjects();
    if (objects.length === 0) return;
    const selection = new fabric.ActiveSelection(objects, { canvas: this.canvas });
    this.canvas.setActiveObject(selection);
    this.canvas.requestRenderAll();
  }

  deleteSelected() {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;

    if (active instanceof fabric.ActiveSelection) {
      active.getObjects().forEach((obj) => {
        const id = (obj as any).__objectId;
        this.canvas!.remove(obj);
        if (id) this.onObjectRemoved?.(id);
      });
    } else {
      const id = (active as any).__objectId;
      this.canvas.remove(active);
      if (id) this.onObjectRemoved?.(id);
    }
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
  }

  duplicateSelected() {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject();
    if (!active) return;

    active.clone().then((cloned: fabric.FabricObject) => {
      const id = uuidv4();
      (cloned as any).__objectId = id;
      cloned.set({ left: (cloned.left ?? 0) + 20, top: (cloned.top ?? 0) + 20 });
      this.canvas!.add(cloned);
      this.canvas!.setActiveObject(cloned);
      this.canvas!.requestRenderAll();
      this._emitObjectAdded(cloned, id);
    });
  }

  // ============================================================
  // Grid
  // ============================================================

  drawGrid(gridSize: number, color = 'rgba(0,0,0,0.06)') {
    if (!this.canvas) return;
    this.clearGrid();
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();
    const lines: fabric.Line[] = [];

    for (let x = 0; x <= width; x += gridSize) {
      lines.push(new fabric.Line([x, 0, x, height], {
        stroke: color, strokeWidth: 0.5, selectable: false, evented: false,
      }));
    }
    for (let y = 0; y <= height; y += gridSize) {
      lines.push(new fabric.Line([0, y, width, y], {
        stroke: color, strokeWidth: 0.5, selectable: false, evented: false,
      }));
    }

    this.gridGroup = new fabric.Group(lines, {
      selectable: false, evented: false,
    });
    // Mark grid group so it's excluded from JSON export
    (this.gridGroup as any).__isGrid = true;
    this.canvas.add(this.gridGroup);
    this.canvas.sendObjectToBack(this.gridGroup);
    this.canvas.requestRenderAll();
  }

  clearGrid() {
    if (!this.canvas || !this.gridGroup) return;
    this.canvas.remove(this.gridGroup);
    this.gridGroup = null;
    this.canvas.requestRenderAll();
  }

  // ============================================================
  // Export
  // ============================================================

  exportToPNG(scale = 2): string {
    if (!this.canvas) return '';
    return this.canvas.toDataURL({ format: 'png', multiplier: scale });
  }

  exportToSVG(): string {
    if (!this.canvas) return '';
    return this.canvas.toSVG();
  }

  exportToJSON(): string {
    if (!this.canvas) return '{}';
    return JSON.stringify(this.canvas.toObject(['__objectId']));
  }

  loadFromJSON(json: string): Promise<void> {
    if (!this.canvas) return Promise.resolve();
    return new Promise((resolve) => {
      this.canvas!.loadFromJSON(JSON.parse(json)).then(() => {
        // Apply selection styling to all loaded objects
        this.canvas!.getObjects().forEach((obj) => {
          this._applySelectionStyle(obj);
        });
        this.canvas!.requestRenderAll();
        resolve();
      });
    });
  }

  // ============================================================
  // Image Upload
  // ============================================================

  addImage(url: string, left: number, top: number): Promise<string> {
    return new Promise((resolve) => {
      if (!this.canvas) { resolve(''); return; }
      const id = uuidv4();
      fabric.FabricImage.fromURL(url).then((img) => {
        img.set({ left, top });
        // Scale down large images
        const maxDim = 400;
        if (img.width! > maxDim || img.height! > maxDim) {
          const scaleFactor = maxDim / Math.max(img.width!, img.height!);
          img.scale(scaleFactor);
        }
        (img as any).__objectId = id;
        this._applySelectionStyle(img);
        this.canvas!.add(img);
        this.canvas!.requestRenderAll();
        this._emitObjectAdded(img, id);
        resolve(id);
      });
    });
  }

  // ============================================================
  // Private: Event Listeners
  // ============================================================

  private _setupEventListeners() {
    if (!this.canvas) return;

    // Wheel zoom
    this.canvas.on('mouse:wheel', (opt) => {
      const e = opt.e as WheelEvent;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY;
      const zoom = this.getZoom();
      const newZoom = delta > 0 ? zoom - ZOOM_STEP : zoom + ZOOM_STEP;
      this.setZoom(newZoom, { x: e.offsetX, y: e.offsetY });
    });

    // Middle-click / space-bar pan
    this.canvas.on('mouse:down', (opt) => {
      const e = opt.e as MouseEvent;
      // Middle mouse button or right-click pan
      if (e.button === 1 || (e.altKey && e.button === 0)) {
        this.isPanning = true;
        this.lastPanPoint = { x: e.clientX, y: e.clientY };
        this.canvas!.selection = false;
      }
    });

    this.canvas.on('mouse:move', (opt) => {
      if (!this.isPanning || !this.canvas) return;
      const e = opt.e as MouseEvent;
      const vpt = this.canvas.viewportTransform!;
      vpt[4] += e.clientX - this.lastPanPoint.x;
      vpt[5] += e.clientY - this.lastPanPoint.y;
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      this.canvas.setViewportTransform(vpt);
      this._emitViewportChange();
      this.canvas.requestRenderAll();
    });

    this.canvas.on('mouse:up', () => {
      this.isPanning = false;
      if (this.canvas) this.canvas.selection = true;
    });

    // Selection events
    this.canvas.on('selection:created', (e) => {
      const selected = e.selected ?? [];
      const ids = selected.map((obj) => (obj as any).__objectId).filter(Boolean);
      this.onSelectionChanged?.(ids);
    });

    this.canvas.on('selection:updated', (e) => {
      const selected = e.selected ?? [];
      const ids = selected.map((obj) => (obj as any).__objectId).filter(Boolean);
      this.onSelectionChanged?.(ids);
    });

    this.canvas.on('selection:cleared', () => {
      this.onSelectionChanged?.([]);
    });

    // Object modified
    this.canvas.on('object:modified', (e) => {
      const obj = e.target;
      if (obj && (obj as any).__objectId) {
        this._emitObjectModified(obj, (obj as any).__objectId);
      }
    });

    // Path created (freehand drawing)
    this.canvas.on('path:created', (e) => {
      const path = (e as any).path as fabric.FabricObject;
      if (path) {
        const id = uuidv4();
        (path as any).__objectId = id;
        this._applySelectionStyle(path);
        this._emitObjectAdded(path, id);
      }
    });
  }

  // ============================================================
  // Private: Emit helpers
  // ============================================================

  private _emitObjectAdded(fabricObj: fabric.FabricObject, id: string) {
    const obj = this._fabricToCanvasObject(fabricObj, id);
    this.onObjectAdded?.(obj);
  }

  private _emitObjectModified(fabricObj: fabric.FabricObject, id: string) {
    const obj = this._fabricToCanvasObject(fabricObj, id);
    this.onObjectModified?.(obj);
  }

  private _emitViewportChange() {
    if (!this.canvas) return;
    const zoom = this.canvas.getZoom();
    const vpt = this.canvas.viewportTransform!;
    this.onViewportChanged?.(zoom, vpt[4], vpt[5]);
  }

  private _fabricToCanvasObject(fabricObj: fabric.FabricObject, id: string): CanvasObject {
    const bound = fabricObj.getBoundingRect();
    return {
      id,
      type: this._detectType(fabricObj),
      left: fabricObj.left ?? 0,
      top: fabricObj.top ?? 0,
      width: bound.width,
      height: bound.height,
      angle: fabricObj.angle ?? 0,
      scaleX: fabricObj.scaleX ?? 1,
      scaleY: fabricObj.scaleY ?? 1,
      stroke: {
        color: (fabricObj.stroke as string) ?? '#000000',
        width: fabricObj.strokeWidth ?? 2,
        dashArray: fabricObj.strokeDashArray as number[] | undefined,
        opacity: fabricObj.opacity ?? 1,
      },
      fill: {
        color: typeof fabricObj.fill === 'string' ? fabricObj.fill : 'transparent',
        opacity: fabricObj.opacity ?? 1,
      },
      locked: fabricObj.lockMovementX ?? false,
      visible: fabricObj.visible ?? true,
      layerOrder: this.canvas?.getObjects().indexOf(fabricObj) ?? 0,
      text: (fabricObj as any).text,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private _detectType(obj: fabric.FabricObject): DrawingTool {
    if (obj instanceof fabric.Rect) return 'rectangle';
    if (obj instanceof fabric.Circle) return 'circle';
    if (obj instanceof fabric.Ellipse) return 'ellipse';
    if (obj instanceof fabric.Line) return 'line';
    if (obj instanceof fabric.IText || obj instanceof fabric.Textbox) return 'text';
    if (obj instanceof fabric.Path) return 'pencil';
    if (obj instanceof fabric.Polygon) return 'diamond';
    if (obj instanceof fabric.Group) return 'arrow'; // simplification
    if (obj instanceof fabric.FabricImage) return 'image';
    return 'select';
  }

  // ============================================================
  // Get object by ID
  // ============================================================

  getObjectById(id: string): fabric.FabricObject | undefined {
    return this.canvas?.getObjects().find((obj) => (obj as any).__objectId === id);
  }

  removeObjectById(id: string) {
    const obj = this.getObjectById(id);
    if (obj && this.canvas) {
      this.canvas.remove(obj);
      this.canvas.requestRenderAll();
    }
  }
}

/** Singleton instance */
export const canvasManager = new CanvasManager();
