/**
 * IndexedDB persistence layer for offline support.
 * Uses the `idb` library for a Promise-based IndexedDB API.
 * 
 * Stores canvas snapshots, user preferences, and board metadata
 * locally for offline-first functionality with eventual sync.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'drawspace';
const DB_VERSION = 1;

// Store names
const STORES = {
  boards: 'boards',
  snapshots: 'snapshots',
  preferences: 'preferences',
} as const;

let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Get or initialize the IndexedDB database.
 */
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Boards store
        if (!db.objectStoreNames.contains(STORES.boards)) {
          const boardStore = db.createObjectStore(STORES.boards, { keyPath: 'id' });
          boardStore.createIndex('updatedAt', 'updatedAt');
          boardStore.createIndex('name', 'name');
        }
        // Snapshots store
        if (!db.objectStoreNames.contains(STORES.snapshots)) {
          const snapshotStore = db.createObjectStore(STORES.snapshots, { keyPath: 'id' });
          snapshotStore.createIndex('boardId', 'boardId');
          snapshotStore.createIndex('createdAt', 'createdAt');
        }
        // Preferences store
        if (!db.objectStoreNames.contains(STORES.preferences)) {
          db.createObjectStore(STORES.preferences, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// ============================================================
// Board operations
// ============================================================

export interface LocalBoard {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  canvasJSON: string;
}

export async function saveBoard(board: LocalBoard): Promise<void> {
  const db = await getDB();
  await db.put(STORES.boards, board);
}

export async function getBoard(id: string): Promise<LocalBoard | undefined> {
  const db = await getDB();
  return db.get(STORES.boards, id);
}

export async function getAllBoards(): Promise<LocalBoard[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORES.boards, 'updatedAt');
}

export async function deleteBoard(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORES.boards, id);
  // Also delete associated snapshots
  const tx = db.transaction(STORES.snapshots, 'readwrite');
  const index = tx.store.index('boardId');
  let cursor = await index.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// ============================================================
// Snapshot operations (versioning)
// ============================================================

export interface LocalSnapshot {
  id: string;
  boardId: string;
  version: number;
  canvasJSON: string;
  createdAt: string;
}

export async function saveSnapshot(snapshot: LocalSnapshot): Promise<void> {
  const db = await getDB();
  await db.put(STORES.snapshots, snapshot);
}

export async function getSnapshotsForBoard(boardId: string): Promise<LocalSnapshot[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORES.snapshots, 'boardId', boardId);
}

export async function getLatestSnapshot(boardId: string): Promise<LocalSnapshot | undefined> {
  const snapshots = await getSnapshotsForBoard(boardId);
  return snapshots.sort((a, b) => b.version - a.version)[0];
}

// ============================================================
// Preferences operations
// ============================================================

export async function setPreference(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put(STORES.preferences, { key, value });
}

export async function getPreference<T = any>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const result = await db.get(STORES.preferences, key);
  return result?.value;
}

// ============================================================
// Auto-save utility
// ============================================================

let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start auto-saving the canvas to IndexedDB at a given interval.
 */
export function startAutoSave(
  boardId: string,
  getCanvasJSON: () => string,
  intervalMs = 30000
) {
  stopAutoSave();
  autoSaveTimer = setInterval(async () => {
    try {
      const json = getCanvasJSON();
      const now = new Date().toISOString();
      await saveBoard({
        id: boardId,
        name: 'Untitled Board',
        canvasJSON: json,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      console.warn('[AutoSave] Failed to save:', err);
    }
  }, intervalMs);
}

export function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}
