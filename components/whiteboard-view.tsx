'use client';

import { useEffect } from 'react';
import {
  InfiniteCanvas,
  Toolbar,
  TopBar,
  ZoomControls,
  PropertiesPanel,
  LayersPanel,
  CollaboratorCursors,
  ShareDialog,
} from '@/components/canvas';
import { canvasManager } from '@/lib/canvas-manager';
import { startAutoSave, stopAutoSave } from '@/lib/db-local';
import { v4 as uuidv4 } from 'uuid';

/**
 * Main whiteboard view — composes all canvas UI components.
 * This is a client component that orchestrates the entire drawing experience.
 */
export function WhiteboardView() {
  // Auto-save to IndexedDB
  useEffect(() => {
    const boardId = 'local-board-' + (typeof window !== 'undefined' ? window.location.pathname : 'default');

    // Slight delay to ensure canvas is initialized
    const timer = setTimeout(() => {
      startAutoSave(boardId, () => canvasManager.exportToJSON(), 15000);
    }, 3000);

    return () => {
      clearTimeout(timer);
      stopAutoSave();
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden select-none">
      {/* Canvas (full screen background) */}
      <InfiniteCanvas />

      {/* UI Overlays */}
      <TopBar />
      <Toolbar />
      <ZoomControls />
      <PropertiesPanel />
      <LayersPanel />
      <CollaboratorCursors />

      {/* Dialogs */}
      <ShareDialog />
    </div>
  );
}
