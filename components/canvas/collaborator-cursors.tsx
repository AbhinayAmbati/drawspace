'use client';

import { motion } from 'framer-motion';
import { useCollaborationStore } from '@/stores';
import { MousePointer2 } from 'lucide-react';

/**
 * Renders animated cursors for all remote collaborators.
 * Each cursor has smooth interpolation, a color-coded pointer, and a name label.
 */
export function CollaboratorCursors() {
  const collaborators = useCollaborationStore((s) => s.collaborators);
  const userId = useCollaborationStore((s) => s.userId);

  return (
    <div className="pointer-events-none fixed inset-0 z-[999] overflow-hidden">
      {Array.from(collaborators.entries()).map(([id, collab]) => {
        if (id === userId) return null;
        return (
          <motion.div
            key={id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: collab.cursor.x,
              y: collab.cursor.y,
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{
              x: { type: 'spring', stiffness: 200, damping: 25 },
              y: { type: 'spring', stiffness: 200, damping: 25 },
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 },
            }}
            className="absolute top-0 left-0"
          >
            {/* Cursor icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-md"
            >
              <path
                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19807L11.7841 12.3673H5.65376Z"
                fill={collab.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Name label */}
            <div
              className="absolute left-4 top-4 px-2 py-0.5 rounded-md text-[10px] font-medium text-white whitespace-nowrap shadow-sm"
              style={{ backgroundColor: collab.color }}
            >
              {collab.name}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
