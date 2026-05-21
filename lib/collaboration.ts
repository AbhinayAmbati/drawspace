/**
 * Yjs CRDT Collaboration Provider
 * 
 * Manages real-time synchronization between collaborators using Yjs
 * with a y-websocket backend. Handles:
 * - Document sync via shared Y.Map
 * - Awareness (cursors, presence, selection)
 * - Reconnection with exponential backoff
 * - Throttled cursor broadcasts
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useCollaborationStore } from '@/stores';
import { canvasManager } from '@/lib/canvas-manager';
import type { CanvasObject } from '@/types';

// ============================================================
// Constants
// ============================================================

const CURSOR_THROTTLE_MS = 50;
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';

// ============================================================
// Collaboration Manager (singleton)
// ============================================================

export class CollaborationManager {
  private doc: Y.Doc | null = null;
  private provider: WebsocketProvider | null = null;
  private objectsMap: Y.Map<any> | null = null;
  private lastCursorBroadcast = 0;
  private cursorThrottleTimer: ReturnType<typeof setTimeout> | null = null;

  /** Whether the provider is currently connected */
  get isConnected(): boolean {
    return this.provider?.wsconnected ?? false;
  }

  /**
   * Connect to a collaboration room.
   * Creates a Y.Doc, connects via WebSocket, and sets up awareness.
   */
  connect(roomId: string, userId: string, userName: string, userColor: string) {
    // Clean up any existing connection
    this.disconnect();

    const store = useCollaborationStore.getState();
    store.setRoom(roomId);
    store.setUser(userId, userName, userColor);
    store.setConnectionStatus('connecting');

    // Create Yjs document
    this.doc = new Y.Doc();
    this.objectsMap = this.doc.getMap('objects');

    // Connect via WebSocket
    this.provider = new WebsocketProvider(WS_URL, roomId, this.doc, {
      connect: true,
      maxBackoffTime: 10000,
    });

    // ── Awareness setup ──
    const awareness = this.provider.awareness;

    // Set local user state
    awareness.setLocalStateField('user', {
      id: userId,
      name: userName,
      color: userColor,
      cursor: { x: 0, y: 0 },
      selectedIds: [],
    });

    // Listen for awareness changes (other users' cursors/presence)
    awareness.on('change', () => {
      const states = awareness.getStates();
      const collabStore = useCollaborationStore.getState();

      states.forEach((state, clientId) => {
        const user = state.user;
        if (!user || user.id === userId) return;

        // Add or update collaborator
        const existing = collabStore.collaborators.get(user.id);
        if (!existing) {
          collabStore.addCollaborator(user.id, user.name, user.color);
        }
        if (user.cursor) {
          collabStore.updateCursor(user.id, user.cursor.x, user.cursor.y);
        }
      });

      // Remove disconnected users
      const activeIds = new Set<string>();
      states.forEach((state) => {
        if (state.user?.id) activeIds.add(state.user.id);
      });
      collabStore.collaborators.forEach((_, id) => {
        if (!activeIds.has(id) && id !== userId) {
          collabStore.removeCollaborator(id);
        }
      });
    });

    // ── Connection status listeners ──
    this.provider.on('status', (event: { status: string }) => {
      const collabStore = useCollaborationStore.getState();
      switch (event.status) {
        case 'connecting':
          collabStore.setConnectionStatus('connecting');
          break;
        case 'connected':
          collabStore.setConnectionStatus('connected');
          break;
        case 'disconnected':
          collabStore.setConnectionStatus('disconnected');
          break;
      }
    });

    // ── Sync Yjs objects map → Fabric canvas ──
    this.objectsMap.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const objData = this.objectsMap!.get(key);
          if (objData) {
            this._applyRemoteObject(key, objData);
          }
        } else if (change.action === 'delete') {
          canvasManager.removeObjectById(key);
        }
      });
    });
  }

  /**
   * Disconnect from the current room and clean up.
   */
  disconnect() {
    if (this.cursorThrottleTimer) {
      clearTimeout(this.cursorThrottleTimer);
      this.cursorThrottleTimer = null;
    }

    if (this.provider) {
      this.provider.disconnect();
      this.provider.destroy();
      this.provider = null;
    }

    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }

    this.objectsMap = null;

    const store = useCollaborationStore.getState();
    store.setConnectionStatus('disconnected');
    store.clearCollaborators();
    store.setRoom('');
  }

  /**
   * Broadcast local cursor position to all peers (throttled).
   */
  broadcastCursor(x: number, y: number) {
    const now = Date.now();
    if (now - this.lastCursorBroadcast < CURSOR_THROTTLE_MS) {
      // Throttle: schedule a final update
      if (this.cursorThrottleTimer) clearTimeout(this.cursorThrottleTimer);
      this.cursorThrottleTimer = setTimeout(() => {
        this._doBroadcastCursor(x, y);
      }, CURSOR_THROTTLE_MS);
      return;
    }
    this._doBroadcastCursor(x, y);
  }

  /**
   * Broadcast local selection to peers.
   */
  broadcastSelection(selectedIds: string[]) {
    if (!this.provider) return;
    this.provider.awareness.setLocalStateField('user', {
      ...this.provider.awareness.getLocalState()?.user,
      selectedIds,
    });
  }

  /**
   * Sync a local object change to the shared Yjs document.
   */
  syncObject(id: string, data: Partial<CanvasObject>) {
    if (!this.objectsMap || !this.doc) return;
    this.doc.transact(() => {
      const existing = this.objectsMap!.get(id) || {};
      this.objectsMap!.set(id, { ...existing, ...data });
    });
  }

  /**
   * Remove an object from the shared Yjs document.
   */
  removeObject(id: string) {
    if (!this.objectsMap || !this.doc) return;
    this.doc.transact(() => {
      this.objectsMap!.delete(id);
    });
  }

  /**
   * Get all objects from the shared document.
   */
  getSharedObjects(): Map<string, any> {
    if (!this.objectsMap) return new Map();
    const result = new Map<string, any>();
    this.objectsMap.forEach((value, key) => {
      result.set(key, value);
    });
    return result;
  }

  // ── Private helpers ──

  private _doBroadcastCursor(x: number, y: number) {
    if (!this.provider) return;
    this.lastCursorBroadcast = Date.now();
    this.provider.awareness.setLocalStateField('user', {
      ...this.provider.awareness.getLocalState()?.user,
      cursor: { x, y },
    });
  }

  /**
   * Apply a remote object update to the local Fabric canvas.
   * Attempts to update existing object or create a new one.
   */
  private _applyRemoteObject(id: string, data: any) {
    // Check if object already exists on canvas
    const existing = canvasManager.getObjectById(id);
    if (existing) {
      // Update existing object properties
      existing.set({
        left: data.left,
        top: data.top,
        scaleX: data.scaleX,
        scaleY: data.scaleY,
        angle: data.angle,
      });
      existing.setCoords();
      canvasManager.canvas?.requestRenderAll();
    }
    // For truly new objects, they'll be created through the normal
    // canvas flow when the JSON state is applied
  }
}

/** Singleton instance */
export const collaborationManager = new CollaborationManager();
