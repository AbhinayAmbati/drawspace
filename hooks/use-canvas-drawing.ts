'use client';

import { useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { canvasManager } from '@/lib/canvas-manager';
import { useToolStore, useObjectsStore, useHistoryStore, useCanvasStore } from '@/stores';
import type { Point } from '@/types';

/**
 * Hook to handle canvas mouse interactions for shape drawing.
 * 
 * Key UX behaviours:
 * - Live preview: a translucent ghost shape follows the cursor while dragging.
 * - Auto-select: after a shape is drawn it is immediately selected, and the
 *   tool switches back to 'select' so that the user can move / resize it
 *   without accidentally starting a new drawing.
 * - Click-through: if the mouse-down lands on an existing Fabric.js object the
 *   drawing operation is suppressed so that the object can be dragged instead.
 */
export function useCanvasDrawing() {
  const activeTool = useToolStore((s) => s.activeTool);
  const stroke = useToolStore((s) => s.stroke);
  const fill = useToolStore((s) => s.fill);
  const fontSize = useToolStore((s) => s.fontSize);
  const fontFamily = useToolStore((s) => s.fontFamily);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const snapToGrid = useCanvasStore((s) => s.settings.grid.snapToGrid);
  const gridSize = useCanvasStore((s) => s.settings.grid.size);
  const pushState = useHistoryStore((s) => s.pushState);

  const isDrawing = useRef(false);
  const startPoint = useRef<Point>({ x: 0, y: 0 });
  const previewObj = useRef<fabric.FabricObject | null>(null);

  // ── helpers ────────────────────────────────────────────────

  /** Convert a DOM mouse event to canvas-space coordinates. */
  const getCanvasPoint = useCallback((e: React.MouseEvent): Point => {
    const canvas = canvasManager.canvas;
    if (!canvas) return { x: e.clientX, y: e.clientY };
    const rect = (canvas as any).lowerCanvasEl?.getBoundingClientRect();
    if (!rect) return { x: e.clientX, y: e.clientY };

    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform!;
    let x = (e.clientX - rect.left - vpt[4]) / zoom;
    let y = (e.clientY - rect.top - vpt[5]) / zoom;

    if (snapToGrid) {
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }

    return { x, y };
  }, [snapToGrid, gridSize]);

  /** Check whether the mouse-down landed on a Fabric.js object. */
  const isClickOnObject = useCallback((e: React.MouseEvent): boolean => {
    const canvas = canvasManager.canvas;
    if (!canvas) return false;
    const rect = (canvas as any).lowerCanvasEl?.getBoundingClientRect();
    if (!rect) return false;
    const pointer = new fabric.Point(e.clientX - rect.left, e.clientY - rect.top);
    const target = canvas.findTarget(
      { clientX: e.clientX, clientY: e.clientY } as any
    );
    return !!target;
  }, []);

  /** Remove the temporary preview object from the Fabric canvas. */
  const clearPreview = useCallback(() => {
    if (previewObj.current && canvasManager.canvas) {
      canvasManager.canvas.remove(previewObj.current);
      canvasManager.canvas.requestRenderAll();
      previewObj.current = null;
    }
  }, []);

  /** Build (or rebuild) the ghost preview shape for the current tool. */
  const buildPreview = useCallback(
    (start: Point, current: Point) => {
      const canvas = canvasManager.canvas;
      if (!canvas) return;

      // Remove the old preview first
      if (previewObj.current) {
        canvas.remove(previewObj.current);
        previewObj.current = null;
      }

      const left = Math.min(start.x, current.x);
      const top = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);

      // Common styling for the ghost
      const previewStroke = stroke.color;
      const previewFill =
        fill.color === 'transparent' ? 'transparent' : fill.color;
      const ghostOpts: Partial<fabric.FabricObject> = {
        selectable: false,
        evented: false,
        opacity: 0.45,
        strokeDashArray: [6, 4],
      } as any;

      let obj: fabric.FabricObject | null = null;

      switch (activeTool) {
        case 'rectangle': {
          obj = new fabric.Rect({
            left,
            top,
            width,
            height,
            stroke: previewStroke,
            strokeWidth: stroke.width,
            fill: previewFill,
            rx: 8,
            ry: 8,
            ...ghostOpts,
          });
          break;
        }
        case 'circle': {
          const radius = Math.min(width, height) / 2;
          obj = new fabric.Circle({
            left,
            top,
            radius,
            stroke: previewStroke,
            strokeWidth: stroke.width,
            fill: previewFill,
            ...ghostOpts,
          });
          break;
        }
        case 'ellipse': {
          obj = new fabric.Ellipse({
            left,
            top,
            rx: width / 2,
            ry: height / 2,
            stroke: previewStroke,
            strokeWidth: stroke.width,
            fill: previewFill,
            ...ghostOpts,
          });
          break;
        }
        case 'diamond': {
          const size = Math.max(width, height);
          const half = size / 2;
          const points = [
            { x: half, y: 0 },
            { x: size, y: half },
            { x: half, y: size },
            { x: 0, y: half },
          ];
          obj = new fabric.Polygon(points, {
            left,
            top,
            stroke: previewStroke,
            strokeWidth: stroke.width,
            fill: previewFill,
            ...ghostOpts,
          });
          break;
        }
        case 'line': {
          obj = new fabric.Line(
            [start.x, start.y, current.x, current.y],
            {
              stroke: previewStroke,
              strokeWidth: stroke.width,
              ...ghostOpts,
            }
          );
          break;
        }
        case 'arrow': {
          const line = new fabric.Line(
            [start.x, start.y, current.x, current.y],
            {
              stroke: previewStroke,
              strokeWidth: stroke.width,
            }
          );
          const angle = Math.atan2(
            current.y - start.y,
            current.x - start.x
          );
          const headLen = 15;
          const headAngle = Math.PI / 6;
          const arrowHead = new fabric.Polygon(
            [
              { x: current.x, y: current.y },
              {
                x: current.x - headLen * Math.cos(angle - headAngle),
                y: current.y - headLen * Math.sin(angle - headAngle),
              },
              {
                x: current.x - headLen * Math.cos(angle + headAngle),
                y: current.y - headLen * Math.sin(angle + headAngle),
              },
            ],
            {
              fill: previewStroke,
              stroke: previewStroke,
              strokeWidth: 1,
            }
          );
          obj = new fabric.Group([line, arrowHead], {
            left: Math.min(start.x, current.x),
            top: Math.min(start.y, current.y),
            ...ghostOpts,
          });
          break;
        }
      }

      if (obj) {
        // Mark it so it is never serialised / exported
        (obj as any).__isPreview = true;
        canvas.add(obj);
        canvas.requestRenderAll();
        previewObj.current = obj;
      }
    },
    [activeTool, stroke, fill]
  );

  // ── event handlers ─────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only shape-drawing tools use this hook
      if (
        activeTool === 'select' ||
        activeTool === 'pencil' ||
        activeTool === 'eraser'
      )
        return;
      if (e.button !== 0) return;

      // Don't start drawing if the user clicked on an existing object
      if (isClickOnObject(e)) return;

      const point = getCanvasPoint(e);

      // One-shot tools (text, sticky) – create immediately
      if (activeTool === 'text') {
        canvasManager.addText(point.x, point.y, '', fontSize, fontFamily, stroke);
        setActiveTool('select');
        return;
      }
      if (activeTool === 'sticky') {
        canvasManager.addStickyNote(point.x, point.y, stroke);
        setActiveTool('select');
        return;
      }

      // Disable Fabric.js own selection while we're drawing
      if (canvasManager.canvas) {
        canvasManager.canvas.selection = false;
        canvasManager.canvas.discardActiveObject();
        canvasManager.canvas.requestRenderAll();
      }

      isDrawing.current = true;
      startPoint.current = point;
    },
    [activeTool, stroke, fontSize, fontFamily, getCanvasPoint, setActiveTool, isClickOnObject]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing.current) return;
      const current = getCanvasPoint(e);
      buildPreview(startPoint.current, current);
    },
    [getCanvasPoint, buildPreview]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing.current) return;
      isDrawing.current = false;

      // Remove the ghost preview
      clearPreview();

      // Re-enable Fabric selection
      if (canvasManager.canvas) {
        canvasManager.canvas.selection = true;
      }

      const point = getCanvasPoint(e);
      const start = startPoint.current;
      const width = Math.abs(point.x - start.x);
      const height = Math.abs(point.y - start.y);
      const left = Math.min(start.x, point.x);
      const top = Math.min(start.y, point.y);

      // Minimum size threshold
      if (
        width < 5 &&
        height < 5 &&
        activeTool !== 'line' &&
        activeTool !== 'arrow'
      )
        return;

      let newObjId = '';

      switch (activeTool) {
        case 'rectangle':
          newObjId = canvasManager.addRectangle(left, top, width, height, stroke, fill);
          break;
        case 'circle':
          newObjId = canvasManager.addCircle(
            left,
            top,
            Math.min(width, height) / 2,
            stroke,
            fill
          );
          break;
        case 'ellipse':
          newObjId = canvasManager.addEllipse(left, top, width / 2, height / 2, stroke, fill);
          break;
        case 'diamond':
          newObjId = canvasManager.addDiamond(left, top, Math.max(width, height), stroke, fill);
          break;
        case 'line':
          newObjId = canvasManager.addLine(start.x, start.y, point.x, point.y, stroke);
          break;
        case 'arrow':
          newObjId = canvasManager.addArrow(start.x, start.y, point.x, point.y, stroke);
          break;
      }

      // Auto-select the newly drawn shape & switch to select mode
      if (newObjId && canvasManager.canvas) {
        const fabricObj = canvasManager.getObjectById(newObjId);
        if (fabricObj) {
          canvasManager.canvas.setActiveObject(fabricObj);
          canvasManager.canvas.requestRenderAll();
        }
      }
      setActiveTool('select');

      // Push history snapshot
      const json = canvasManager.exportToJSON();
      pushState(json);
    },
    [activeTool, stroke, fill, getCanvasPoint, pushState, clearPreview, setActiveTool]
  );

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isDrawing: isDrawing.current,
  };
}
