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
// Custom Selection Controls Renderers
// ============================================================

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function renderRoundedRectControl(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  styleOverride: any,
  fabricObject: fabric.FabricObject
) {
  const size = fabricObject.cornerSize ?? 10;
  const strokeColor = '#818cf8'; // Premium soft lavender/blue matching reference
  const fillColor = '#ffffff';
  const radius = 2.5;

  ctx.save();
  ctx.translate(left, top);
  ctx.rotate((fabricObject.angle ?? 0) * Math.PI / 180);

  drawRoundedRect(ctx, -size / 2, -size / 2, size, size, radius);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

function renderCircleControl(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  styleOverride: any,
  fabricObject: fabric.FabricObject
) {
  const size = fabricObject.cornerSize ?? 10;
  const strokeColor = '#818cf8';
  const fillColor = '#ffffff';

  ctx.save();
  ctx.translate(left, top);
  ctx.rotate((fabricObject.angle ?? 0) * Math.PI / 180);

  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

// ============================================================
// Arrow Connection and Bending Helpers
// ============================================================

function getConnectionPoints(obj: fabric.FabricObject) {
  const left = obj.left ?? 0;
  const top = obj.top ?? 0;
  const width = obj.width ? obj.width * (obj.scaleX ?? 1) : 0;
  const height = obj.height ? obj.height * (obj.scaleY ?? 1) : 0;
  const center = new fabric.Point(left + width / 2, top + height / 2);
  const angleRad = ((obj.angle ?? 0) * Math.PI) / 180;
  
  const points = [
    new fabric.Point(left + width / 2, top), // top
    new fabric.Point(left + width / 2, top + height), // bottom
    new fabric.Point(left, top + height / 2), // left
    new fabric.Point(left + width, top + height / 2) // right
  ];

  return points.map((p, idx) => {
    if (obj.angle) {
      const cx = center.x;
      const cy = center.y;
      const sin = Math.sin(angleRad);
      const cos = Math.cos(angleRad);
      const rx = (p.x - cx) * cos - (p.y - cy) * sin + cx;
      const ry = (p.x - cx) * sin + (p.y - cy) * cos + cy;
      return { x: rx, y: ry, name: ['top', 'bottom', 'left', 'right'][idx] };
    }
    return { x: p.x, y: p.y, name: ['top', 'bottom', 'left', 'right'][idx] };
  });
}

function snapArrowPoint(pointer: Point, arrow: fabric.Path, isStart: boolean) {
  const canvas = arrow.canvas;
  if (!canvas) return pointer;
  
  const SNAP_DIST = 25;
  let bestPoint = pointer;
  let snappedObjId = '';
  
  const objects = canvas.getObjects();
  for (const obj of objects) {
    if (obj === arrow || (obj as any).__isGrid || (obj as any).__isPreview) continue;
    if ((obj as any).__isArrow) continue;
    
    const connPoints = getConnectionPoints(obj);
    for (const cp of connPoints) {
      const dist = Math.hypot(pointer.x - cp.x, pointer.y - cp.y);
      if (dist < SNAP_DIST) {
        bestPoint = { x: cp.x, y: cp.y };
        snappedObjId = (obj as any).__objectId || '';
        break;
      }
    }
    if (snappedObjId) break;
  }
  
  if (isStart) {
    (arrow as any).__connectedStartId = snappedObjId;
    if (snappedObjId) {
      const snappedObj = objects.find(o => (o as any).__objectId === snappedObjId);
      if (snappedObj) {
        const cp = getConnectionPoints(snappedObj);
        const portIdx = cp.findIndex(p => p.x === bestPoint.x && p.y === bestPoint.y);
        (arrow as any).__startPortIdx = portIdx;
      }
    } else {
      (arrow as any).__startPortIdx = -1;
    }
  } else {
    (arrow as any).__connectedEndId = snappedObjId;
    if (snappedObjId) {
      const snappedObj = objects.find(o => (o as any).__objectId === snappedObjId);
      if (snappedObj) {
        const cp = getConnectionPoints(snappedObj);
        const portIdx = cp.findIndex(p => p.x === bestPoint.x && p.y === bestPoint.y);
        (arrow as any).__endPortIdx = portIdx;
      }
    } else {
      (arrow as any).__endPortIdx = -1;
    }
  }
  
  return bestPoint;
}

function updateArrowPath(target: fabric.Path) {
  const p0 = (target as any).__p0;
  const p1 = (target as any).__p1;
  const p2 = (target as any).__p2;
  if (!p0 || !p1 || !p2) return;
  
  const pathData = `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`;
  (target as any)._setPath(pathData, true);
  
  // Ensure non-zero width/height so Fabric cache canvas works correctly
  const minSize = Math.max(target.strokeWidth || 2, 4);
  const width = Math.max(target.width || 0, minSize);
  const height = Math.max(target.height || 0, minSize);
  target.set({
    width,
    height,
    originX: 'center',
    originY: 'center',
  });
  
  target.dirty = true;
  target.setCoords();
  if (target.canvas) {
    target.canvas.requestRenderAll();
  }
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
    cornerColor: '#ffffff',
    cornerStrokeColor: '#818cf8',    // Soft violet-blue
    cornerSize: 10,
    borderColor: '#818cf8',          // Soft violet-blue
    borderDashArray: null,           // Solid border line
    borderScaleFactor: 1.5,
    padding: 6,
  };

  /** Stamp modern selection styling onto a single Fabric object. */
  private _applySelectionStyle(obj: fabric.FabricObject) {
    obj.set(CanvasManager.SELECTION_STYLE as any);

    if ((obj as any).__isArrow) {
      // 1. Assign custom _render to draw the arrowhead at the end point of the path
      const originalRender = obj._render;
      obj._render = function(this: any, ctx: CanvasRenderingContext2D) {
        originalRender.call(this, ctx);
        
        const path = this.path;
        if (!path || path.length < 2) return;
        const l = -this.pathOffset.x;
        const t = -this.pathOffset.y;
        const localP1 = { x: path[1][1] + l, y: path[1][2] + t };
        const localP2 = { x: path[1][3] + l, y: path[1][4] + t };
        
        const angle = Math.atan2(localP2.y - localP1.y, localP2.x - localP1.x);
        const headLen = 15;
        const headAngle = Math.PI / 6;
        
        ctx.beginPath();
        ctx.moveTo(localP2.x, localP2.y);
        ctx.lineTo(
          localP2.x - headLen * Math.cos(angle - headAngle),
          localP2.y - headLen * Math.sin(angle - headAngle)
        );
        ctx.lineTo(
          localP2.x - headLen * Math.cos(angle + headAngle),
          localP2.y - headLen * Math.sin(angle + headAngle)
        );
        ctx.closePath();
        ctx.fillStyle = this.stroke as string;
        ctx.fill();
      };

      // 2. Define custom arrow controls (start, mid, end)
      obj.controls = {
        start: new fabric.Control({
          x: -0.5,
          y: -0.5,
          positionHandler: (dim: any, finalMatrix: any, fabricObject: fabric.FabricObject) => {
            const pathObj = fabricObject as fabric.Path;
            if (!pathObj.path || pathObj.path.length === 0) return new fabric.Point(0, 0);
            const p = new fabric.Point(
              (pathObj.path[0][1] as number) - pathObj.pathOffset.x,
              (pathObj.path[0][2] as number) - pathObj.pathOffset.y
            );
            return fabric.util.transformPoint(p, finalMatrix);
          },
          actionHandler: (eventData: any, transform: any, x: number, y: number) => {
            const target = transform.target as fabric.Path;
            const canvas = target.canvas;
            if (!canvas) return false;
            
            const pointer = (canvas as any).getScenePoint 
              ? (canvas as any).getScenePoint(eventData) 
              : (canvas as any).getPointer(eventData);
            const snappedPointer = snapArrowPoint(pointer, target, true);
            (target as any).__p0 = snappedPointer;
            
            updateArrowPath(target);
            return true;
          },
          actionName: 'modifyStart',
          cursorStyle: 'pointer',
          render: renderCircleControl,
        }),
        mid: new fabric.Control({
          x: 0,
          y: 0,
          positionHandler: (dim: any, finalMatrix: any, fabricObject: fabric.FabricObject) => {
            const pathObj = fabricObject as fabric.Path;
            if (!pathObj.path || pathObj.path.length < 2) return new fabric.Point(0, 0);
            const p = new fabric.Point(
              (pathObj.path[1][1] as number) - pathObj.pathOffset.x,
              (pathObj.path[1][2] as number) - pathObj.pathOffset.y
            );
            return fabric.util.transformPoint(p, finalMatrix);
          },
          actionHandler: (eventData: any, transform: any, x: number, y: number) => {
            const target = transform.target as fabric.Path;
            const canvas = target.canvas;
            if (!canvas) return false;
            
            const pointer = (canvas as any).getScenePoint 
              ? (canvas as any).getScenePoint(eventData) 
              : (canvas as any).getPointer(eventData);
            (target as any).__p1 = pointer;
            
            updateArrowPath(target);
            return true;
          },
          actionName: 'modifyMid',
          cursorStyle: 'pointer',
          render: (ctx, left, top, styleOverride, fabricObject) => {
            const size = fabricObject.cornerSize ?? 10;
            const strokeColor = '#818cf8';
            const fillColor = '#818cf8'; // Solid filled circle in the middle
            
            ctx.save();
            ctx.translate(left, top);
            ctx.rotate((fabricObject.angle ?? 0) * Math.PI / 180);
            
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            ctx.restore();
          },
        }),
        end: new fabric.Control({
          x: 0.5,
          y: 0.5,
          positionHandler: (dim: any, finalMatrix: any, fabricObject: fabric.FabricObject) => {
            const pathObj = fabricObject as fabric.Path;
            if (!pathObj.path || pathObj.path.length < 2) return new fabric.Point(0, 0);
            const p = new fabric.Point(
              (pathObj.path[1][3] as number) - pathObj.pathOffset.x,
              (pathObj.path[1][4] as number) - pathObj.pathOffset.y
            );
            return fabric.util.transformPoint(p, finalMatrix);
          },
          actionHandler: (eventData: any, transform: any, x: number, y: number) => {
            const target = transform.target as fabric.Path;
            const canvas = target.canvas;
            if (!canvas) return false;
            
            const pointer = (canvas as any).getScenePoint 
              ? (canvas as any).getScenePoint(eventData) 
              : (canvas as any).getPointer(eventData);
            const snappedPointer = snapArrowPoint(pointer, target, false);
            (target as any).__p2 = snappedPointer;
            
            updateArrowPath(target);
            return true;
          },
          actionName: 'modifyEnd',
          cursorStyle: 'pointer',
          render: renderCircleControl,
        }),
      };
      
      obj.setCoords();
      return;
    }

    // Apply custom control handles to match reference design exactly
    if (obj.controls) {
      Object.entries(obj.controls).forEach(([key, control]) => {
        if (key === 'ml' || key === 'mr' || key === 'mt' || key === 'mb') {
          // Hide middle edge controls to match the clean corner-only reference design
          control.visible = false;
        } else if (key === 'mtr') {
          // Rotation handle: floating hollow circle, no vertical connection line
          control.render = renderCircleControl;
          (control as any).withConnection = false;
          control.offsetY = -24;
          control.visible = true;
        } else {
          // Corner handles: hollow rounded rectangles
          control.render = renderRoundedRectControl;
          control.visible = true;
        }
      });
    }
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

    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    const pathData = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
    const arrowPath = new fabric.Path(pathData, {
      stroke: stroke.color,
      strokeWidth: stroke.width,
      strokeDashArray: stroke.dashArray,
      fill: 'transparent',
    }) as any;

    arrowPath.__objectId = id;
    arrowPath.__isArrow = true;
    arrowPath.__p0 = { x: x1, y: y1 };
    arrowPath.__p1 = { x: cx, y: cy };
    arrowPath.__p2 = { x: x2, y: y2 };
    arrowPath.__connectedStartId = '';
    arrowPath.__connectedEndId = '';
    arrowPath.__startPortIdx = -1;
    arrowPath.__endPortIdx = -1;

    updateArrowPath(arrowPath);
    this._applySelectionStyle(arrowPath);
    this.canvas.add(arrowPath);
    this.canvas.requestRenderAll();
    this._emitObjectAdded(arrowPath, id);
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
    return JSON.stringify(this.canvas.toObject([
      '__objectId',
      '__isArrow',
      '__p0',
      '__p1',
      '__p2',
      '__connectedStartId',
      '__connectedEndId',
      '__startPortIdx',
      '__endPortIdx',
    ]));
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

    // Real-time connector arrow following when elements are moved/scaled/rotated
    const updateConnectedArrows = (e: any) => {
      const movedObj = e.target;
      if (!movedObj || !(movedObj as any).__objectId) return;
      
      const movedId = (movedObj as any).__objectId;
      const objects = this.canvas!.getObjects();
      
      objects.forEach((obj) => {
        if ((obj as any).__isArrow) {
          const arrow = obj as fabric.Path;
          let changed = false;
          
          if ((arrow as any).__connectedStartId === movedId) {
            const portIdx = (arrow as any).__startPortIdx ?? 0;
            const cp = getConnectionPoints(movedObj);
            if (cp[portIdx]) {
              (arrow as any).__p0 = { x: cp[portIdx].x, y: cp[portIdx].y };
              changed = true;
            }
          }
          
          if ((arrow as any).__connectedEndId === movedId) {
            const portIdx = (arrow as any).__endPortIdx ?? 0;
            const cp = getConnectionPoints(movedObj);
            if (cp[portIdx]) {
              (arrow as any).__p2 = { x: cp[portIdx].x, y: cp[portIdx].y };
              changed = true;
            }
          }
          
          if (changed) {
            updateArrowPath(arrow);
            this._emitObjectModified(arrow, (arrow as any).__objectId);
          }
        }
      });
    };

    this.canvas.on('object:moving', updateConnectedArrows);
    this.canvas.on('object:scaling', updateConnectedArrows);
    this.canvas.on('object:rotating', updateConnectedArrows);

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
    if (obj instanceof fabric.Path) {
      if ((obj as any).__isArrow) return 'arrow';
      return 'pencil';
    }
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
