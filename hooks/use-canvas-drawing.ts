'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as fabric from 'fabric';
import { canvasManager } from '@/lib/canvas-manager';
import { useToolStore, useHistoryStore, useCanvasStore } from '@/stores';
import type { Point } from '@/types';

/**
 * Hook that registers Fabric-level mouse listeners for shape drawing.
 *
 * Key UX behaviours:
 * - Live preview: the shape renders in real-time as you drag.
 * - Auto-select: after drawing, the shape is selected and the tool
 *   switches to 'select' so the user can immediately move/resize it.
 */
export function useCanvasDrawing(isReady: boolean) {
  const activeTool = useToolStore((s) => s.activeTool);
  const stroke = useToolStore((s) => s.stroke);
  const fill = useToolStore((s) => s.fill);
  const fontSize = useToolStore((s) => s.fontSize);
  const fontFamily = useToolStore((s) => s.fontFamily);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const snapToGrid = useCanvasStore((s) => s.settings.grid.snapToGrid);
  const gridSize = useCanvasStore((s) => s.settings.grid.size);
  const pushState = useHistoryStore((s) => s.pushState);

  // Refs survive re-renders and keep mutable state across Fabric callbacks
  const isDrawing = useRef(false);
  const startPoint = useRef<Point>({ x: 0, y: 0 });
  const previewObj = useRef<fabric.FabricObject | null>(null);

  // Store latest values in refs so Fabric listeners always read current state
  const activeToolRef = useRef(activeTool);
  const strokeRef = useRef(stroke);
  const fillRef = useRef(fill);
  const fontSizeRef = useRef(fontSize);
  const fontFamilyRef = useRef(fontFamily);
  const snapToGridRef = useRef(snapToGrid);
  const gridSizeRef = useRef(gridSize);

  activeToolRef.current = activeTool;
  strokeRef.current = stroke;
  fillRef.current = fill;
  fontSizeRef.current = fontSize;
  fontFamilyRef.current = fontFamily;
  snapToGridRef.current = snapToGrid;
  gridSizeRef.current = gridSize;

  // Refs for store actions (stable across renders)
  const setActiveToolRef = useRef(setActiveTool);
  const pushStateRef = useRef(pushState);
  setActiveToolRef.current = setActiveTool;
  pushStateRef.current = pushState;

  // ── helpers ────────────────────────────────────────────────

  const getCanvasPoint = useCallback((e: MouseEvent): Point => {
    const canvas = canvasManager.canvas;
    if (!canvas) return { x: e.clientX, y: e.clientY };
    const rect = (canvas as any).lowerCanvasEl?.getBoundingClientRect();
    if (!rect) return { x: e.clientX, y: e.clientY };

    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform!;
    let x = (e.clientX - rect.left - vpt[4]) / zoom;
    let y = (e.clientY - rect.top - vpt[5]) / zoom;

    if (snapToGridRef.current) {
      x = Math.round(x / gridSizeRef.current) * gridSizeRef.current;
      y = Math.round(y / gridSizeRef.current) * gridSizeRef.current;
    }

    return { x, y };
  }, []);

  const clearPreview = useCallback(() => {
    if (previewObj.current && canvasManager.canvas) {
      canvasManager.canvas.remove(previewObj.current);
      canvasManager.canvas.requestRenderAll();
      previewObj.current = null;
    }
  }, []);

  const buildPreview = useCallback((start: Point, current: Point) => {
    const canvas = canvasManager.canvas;
    if (!canvas) return;
    const tool = activeToolRef.current;
    const s = strokeRef.current;
    const f = fillRef.current;

    // Remove old preview
    if (previewObj.current) {
      canvas.remove(previewObj.current);
      previewObj.current = null;
    }

    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    const previewStroke = s.color;
    const previewFill = f.color === 'transparent' ? 'transparent' : f.color;
    const common = { selectable: false, evented: false } as any;

    let obj: fabric.FabricObject | null = null;

    switch (tool) {
      case 'rectangle':
        obj = new fabric.Rect({
          left, top, width, height,
          stroke: previewStroke, strokeWidth: s.width,
          fill: previewFill, rx: 8, ry: 8, ...common,
        });
        break;
      case 'circle': {
        const radius = Math.min(width, height) / 2;
        obj = new fabric.Circle({
          left, top, radius,
          stroke: previewStroke, strokeWidth: s.width,
          fill: previewFill, ...common,
        });
        break;
      }
      case 'ellipse':
        obj = new fabric.Ellipse({
          left, top, rx: width / 2, ry: height / 2,
          stroke: previewStroke, strokeWidth: s.width,
          fill: previewFill, ...common,
        });
        break;
      case 'diamond': {
        const size = Math.max(width, height);
        const half = size / 2;
        obj = new fabric.Polygon(
          [{ x: half, y: 0 }, { x: size, y: half }, { x: half, y: size }, { x: 0, y: half }],
          { left, top, stroke: previewStroke, strokeWidth: s.width, fill: previewFill, ...common },
        );
        break;
      }
      case 'line':
        obj = new fabric.Line(
          [start.x, start.y, current.x, current.y],
          { stroke: previewStroke, strokeWidth: s.width, ...common },
        );
        break;
      case 'arrow': {
        const line = new fabric.Line(
          [start.x, start.y, current.x, current.y],
          { stroke: previewStroke, strokeWidth: s.width },
        );

        const angle = Math.atan2(current.y - start.y, current.x - start.x);
        const headLen = 15;
        const headAngle = Math.PI / 6;
        const arrowHead = new fabric.Polygon(
          [
            { x: current.x, y: current.y },
            { x: current.x - headLen * Math.cos(angle - headAngle), y: current.y - headLen * Math.sin(angle - headAngle) },
            { x: current.x - headLen * Math.cos(angle + headAngle), y: current.y - headLen * Math.sin(angle + headAngle) },
          ],
          { fill: previewStroke, stroke: previewStroke, strokeWidth: 1 },
        );
        obj = new fabric.Group([line, arrowHead], {
          left: Math.min(start.x, current.x),
          top: Math.min(start.y, current.y),
          ...common,
        });
        break;
      }
    }

    if (obj) {
      (obj as any).__isPreview = true;
      canvas.add(obj);
      canvas.requestRenderAll();
      previewObj.current = obj;
    }
  }, []);

  // ── Fabric event listeners ─────────────────────────────────

  useEffect(() => {
    const canvas = canvasManager.canvas;
    if (!canvas || !isReady) return;

    const onMouseDown = (opt: any) => {
      const tool = activeToolRef.current;
      if (tool === 'select' || tool === 'pencil' || tool === 'eraser') return;

      const e = opt.e as MouseEvent;
      if (e.button !== 0) return;

      // If clicked on an existing interactive object, let Fabric select/drag it instead of drawing a new shape
      const target = opt.target;
      if (target && !(target as any).__isGrid && !(target as any).__isPreview) {
        return;
      }

      const point = getCanvasPoint(e);

      // One-shot tools
      if (tool === 'text') {
        canvasManager.addText(point.x, point.y, '', fontSizeRef.current, fontFamilyRef.current, strokeRef.current);
        setActiveToolRef.current('select');
        return;
      }
      if (tool === 'sticky') {
        canvasManager.addStickyNote(point.x, point.y, strokeRef.current);
        setActiveToolRef.current('select');
        return;
      }

      canvas.selection = false;
      canvas.discardActiveObject();
      canvas.requestRenderAll();

      isDrawing.current = true;
      startPoint.current = point;
    };

    const onMouseMove = (opt: any) => {
      if (!isDrawing.current) return;
      const e = opt.e as MouseEvent;
      const current = getCanvasPoint(e);
      buildPreview(startPoint.current, current);
    };

    const onMouseUp = (opt: any) => {
      if (!isDrawing.current) return;
      isDrawing.current = false;

      clearPreview();
      canvas.selection = (activeToolRef.current === 'select');

      const e = opt.e as MouseEvent;
      const point = getCanvasPoint(e);
      const start = startPoint.current;
      const tool = activeToolRef.current;
      const s = strokeRef.current;
      const f = fillRef.current;

      const width = Math.abs(point.x - start.x);
      const height = Math.abs(point.y - start.y);
      const left = Math.min(start.x, point.x);
      const top = Math.min(start.y, point.y);

      // Prevent accidental tiny shapes/lines when clicking to de-select
      if (width < 5 && height < 5) return;

      let newObjId = '';
      switch (tool) {
        case 'rectangle':
          newObjId = canvasManager.addRectangle(left, top, width, height, s, f);
          break;
        case 'circle':
          newObjId = canvasManager.addCircle(left, top, Math.min(width, height) / 2, s, f);
          break;
        case 'ellipse':
          newObjId = canvasManager.addEllipse(left, top, width / 2, height / 2, s, f);
          break;
        case 'diamond':
          newObjId = canvasManager.addDiamond(left, top, Math.max(width, height), s, f);
          break;
        case 'line':
          newObjId = canvasManager.addLine(start.x, start.y, point.x, point.y, s);
          break;
        case 'arrow':
          newObjId = canvasManager.addArrow(start.x, start.y, point.x, point.y, s);
          break;
      }

      // Auto-select the new shape
      if (newObjId) {
        const fabricObj = canvasManager.getObjectById(newObjId);
        if (fabricObj) {
          canvas.setActiveObject(fabricObj);
          canvas.requestRenderAll();
        }
      }

      const json = canvasManager.exportToJSON();
      pushStateRef.current(json);
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
    };
  }, [getCanvasPoint, buildPreview, clearPreview, isReady]);

  // No React-level handlers needed anymore — Fabric handles everything
  return {};
}
