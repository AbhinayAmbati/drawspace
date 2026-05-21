'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { canvasManager } from '@/lib/canvas-manager';
import {
  useToolStore,
  useCanvasStore,
  useObjectsStore,
  useHistoryStore,
  useCollaborationStore,
} from '@/stores';
import { useCanvasDrawing, useWindowSize, useKeyboardShortcuts } from '@/hooks';
import type { CanvasObject } from '@/types';

/**
 * The main infinite canvas component.
 * Wraps the Fabric.js canvas element and handles initialization,
 * resizing, tool switching, and store synchronization.
 */
export function InfiniteCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { width, height } = useWindowSize();
  const [isReady, setIsReady] = useState(false);

  // Store selectors
  const activeTool = useToolStore((s) => s.activeTool);
  const stroke = useToolStore((s) => s.stroke);
  const { viewport, setViewport, setZoom, settings } = useCanvasStore();
  const { addObject, updateObject, removeObject, selectObjects, deselectAll } = useObjectsStore();
  const pushState = useHistoryStore((s) => s.pushState);
  const updateCursor = useCollaborationStore((s) => s.updateCursor);
  const userId = useCollaborationStore((s) => s.userId);

  // Drawing interaction hook — registers Fabric-level listeners internally
  useCanvasDrawing(isReady);

  // Keyboard shortcuts
  useKeyboardShortcuts();

  // ============================================================
  // Initialize canvas
  // ============================================================
  useEffect(() => {
    if (!canvasRef.current || width === 0 || height === 0) return;

    if (!canvasManager.canvas) {
      canvasManager.init(canvasRef.current, width, height);

      // Wire up store callbacks
      canvasManager.onObjectAdded = (obj: CanvasObject) => {
        addObject(obj);
      };
      canvasManager.onObjectModified = (obj: CanvasObject) => {
        updateObject(obj.id, obj);
      };
      canvasManager.onObjectRemoved = (id: string) => {
        removeObject(id);
      };
      canvasManager.onSelectionChanged = (ids: string[]) => {
        if (ids.length > 0) selectObjects(ids);
        else deselectAll();
      };
      canvasManager.onViewportChanged = (zoom, panX, panY) => {
        setViewport({ zoom, panX, panY });
      };

      setIsReady(true);
    }

    return () => {
      // Don't destroy on resize, only on true unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // ============================================================
  // Handle resize
  // ============================================================
  useEffect(() => {
    if (canvasManager.canvas && width > 0 && height > 0) {
      canvasManager.resize(width, height);
    }
  }, [width, height]);

  // ============================================================
  // Handle tool changes
  // ============================================================
  useEffect(() => {
    if (!canvasManager.canvas) return;

    if (activeTool === 'pencil') {
      canvasManager.enableFreeDrawing(stroke);
    } else if (activeTool === 'eraser') {
      canvasManager.enableEraser();
    } else {
      canvasManager.disableFreeDrawing();
    }

    // Only disable selection/interactivity in pencil and eraser modes
    const isPencilOrEraser = activeTool === 'pencil' || activeTool === 'eraser';
    const isShapeTool = activeTool !== 'select' && !isPencilOrEraser;

    canvasManager.canvas.selection = !isShapeTool && !isPencilOrEraser;
    canvasManager.canvas.getObjects().forEach((obj) => {
      if ((obj as any).__isGrid || (obj as any).__isPreview) return;
      obj.selectable = !isPencilOrEraser;
      obj.evented = !isPencilOrEraser;
    });
    canvasManager.canvas.requestRenderAll();
  }, [activeTool, stroke]);

  // ============================================================
  // Handle grid
  // ============================================================
  useEffect(() => {
    if (!canvasManager.canvas) return;
    if (settings.grid.enabled) {
      canvasManager.drawGrid(settings.grid.size);
    } else {
      canvasManager.clearGrid();
    }
  }, [settings.grid.enabled, settings.grid.size]);

  // ============================================================
  // Handle background color
  // ============================================================
  useEffect(() => {
    if (!canvasManager.canvas) return;
    canvasManager.canvas.backgroundColor = settings.backgroundColor;
    canvasManager.canvas.requestRenderAll();
  }, [settings.backgroundColor]);

  // ============================================================
  // Cursor tracking for collaboration
  // ============================================================
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Collaboration cursor tracking
    if (userId) {
      updateCursor(userId, e.clientX, e.clientY);
    }
  }, [userId, updateCursor]);

  // ============================================================
  // Dynamic cursor style based on active tool
  // ============================================================
  const getCursorStyle = () => {
    switch (activeTool) {
      case 'select': return 'default';
      case 'pencil': return 'crosshair';
      case 'eraser': return 'crosshair';
      case 'text': return 'text';
      default: return 'crosshair';
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="fixed inset-0 overflow-hidden bg-neutral-50 dark:bg-neutral-950"
      style={{ cursor: getCursorStyle() }}
      onMouseMove={handleMouseMove}
    >
      {/* Canvas background pattern */}
      {settings.grid.enabled && (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: `${settings.grid.size * viewport.zoom}px ${settings.grid.size * viewport.zoom}px`,
            backgroundPosition: `${viewport.panX}px ${viewport.panY}px`,
          }}
        />
      )}

      <canvas ref={canvasRef} className="block" />

      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading canvas...</p>
          </div>
        </div>
      )}
    </div>
  );
}
