'use client';

import { useEffect } from 'react';
import { useToolStore, useHistoryStore, useCanvasStore, useObjectsStore, useUIStore } from '@/stores';
import { canvasManager } from '@/lib/canvas-manager';
import type { DrawingTool } from '@/types';

/** Tool shortcut map */
const TOOL_SHORTCUTS: Record<string, DrawingTool> = {
  v: 'select',
  s: 'select',
  p: 'pencil',
  r: 'rectangle',
  c: 'circle',
  e: 'ellipse',
  d: 'diamond',
  l: 'line',
  a: 'arrow',
  t: 'text',
  n: 'sticky',
  x: 'eraser',
};

export function useKeyboardShortcuts() {
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const { undo, redo, canUndo, canRedo } = useHistoryStore();
  const deselectAll = useObjectsStore((s) => s.deselectAll);
  const { toggleGrid, toggleSnapToGrid } = useCanvasStore();
  const { setShowExportDialog, setShowShareDialog, toggleLayers, toggleProperties } = useUIStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();

      // Undo: Ctrl+Z
      if (ctrl && !shift && key === 'z') {
        e.preventDefault();
        if (canUndo) {
          const snapshot = undo();
          if (snapshot) canvasManager.loadFromJSON(snapshot);
        }
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((ctrl && shift && key === 'z') || (ctrl && key === 'y')) {
        e.preventDefault();
        if (canRedo) {
          const snapshot = redo();
          if (snapshot) canvasManager.loadFromJSON(snapshot);
        }
        return;
      }

      // Delete
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        canvasManager.deleteSelected();
        return;
      }

      // Select all: Ctrl+A
      if (ctrl && key === 'a') {
        e.preventDefault();
        canvasManager.selectAll();
        return;
      }

      // Duplicate: Ctrl+D
      if (ctrl && key === 'd') {
        e.preventDefault();
        canvasManager.duplicateSelected();
        return;
      }

      // Export: Ctrl+Shift+E
      if (ctrl && shift && key === 'e') {
        e.preventDefault();
        setShowExportDialog(true);
        return;
      }

      // Share: Ctrl+Shift+S
      if (ctrl && shift && key === 's') {
        e.preventDefault();
        setShowShareDialog(true);
        return;
      }

      // Toggle grid: Ctrl+G
      if (ctrl && key === 'g') {
        e.preventDefault();
        toggleGrid();
        return;
      }

      // Snap to grid: Ctrl+Shift+G
      if (ctrl && shift && key === 'g') {
        e.preventDefault();
        toggleSnapToGrid();
        return;
      }

      // Toggle layers panel
      if (ctrl && key === 'l') {
        e.preventDefault();
        toggleLayers();
        return;
      }

      // Escape — deselect
      if (key === 'escape') {
        deselectAll();
        canvasManager.canvas?.discardActiveObject();
        canvasManager.canvas?.requestRenderAll();
        return;
      }

      // Zoom: Ctrl + / -
      if (ctrl && (key === '=' || key === '+')) {
        e.preventDefault();
        canvasManager.zoomIn();
        return;
      }
      if (ctrl && key === '-') {
        e.preventDefault();
        canvasManager.zoomOut();
        return;
      }
      if (ctrl && key === '0') {
        e.preventDefault();
        canvasManager.resetView();
        return;
      }

      // Zoom to fit: Ctrl+Shift+1
      if (ctrl && shift && key === '1') {
        e.preventDefault();
        canvasManager.zoomToFit();
        return;
      }

      // Tool shortcuts (single key, no modifier)
      if (!ctrl && !shift && TOOL_SHORTCUTS[key]) {
        e.preventDefault();
        setActiveTool(TOOL_SHORTCUTS[key]);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveTool, undo, redo, canUndo, canRedo, deselectAll, toggleGrid, toggleSnapToGrid, setShowExportDialog, setShowShareDialog, toggleLayers, toggleProperties]);
}
