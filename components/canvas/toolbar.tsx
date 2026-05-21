'use client';

import { motion } from 'framer-motion';
import { useToolStore, useCanvasStore } from '@/stores';
import { canvasManager } from '@/lib/canvas-manager';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import type { DrawingTool } from '@/types';
import {
  MousePointer2,
  Pencil,
  Square,
  Circle,
  Diamond,
  Minus,
  MoveRight,
  Type,
  StickyNote,
  ImagePlus,
  Eraser,
  Hand,
} from 'lucide-react';

interface ToolConfig {
  id: DrawingTool;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
}

const TOOLS: ToolConfig[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: <MousePointer2 size={18} /> },
  { id: 'pencil', label: 'Pencil', shortcut: 'P', icon: <Pencil size={18} /> },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: <Square size={18} /> },
  { id: 'circle', label: 'Circle', shortcut: 'C', icon: <Circle size={18} /> },
  { id: 'diamond', label: 'Diamond', shortcut: 'D', icon: <Diamond size={18} /> },
  { id: 'line', label: 'Line', shortcut: 'L', icon: <Minus size={18} /> },
  { id: 'arrow', label: 'Arrow', shortcut: 'A', icon: <MoveRight size={18} /> },
  { id: 'text', label: 'Text', shortcut: 'T', icon: <Type size={18} /> },
  { id: 'sticky', label: 'Sticky Note', shortcut: 'N', icon: <StickyNote size={18} /> },
  { id: 'image', label: 'Image', shortcut: 'I', icon: <ImagePlus size={18} /> },
  { id: 'eraser', label: 'Eraser', shortcut: 'X', icon: <Eraser size={18} /> },
];

export function Toolbar() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const stroke = useToolStore((s) => s.stroke);

  const handleToolClick = (tool: DrawingTool) => {
    setActiveTool(tool);

    // Handle special tool modes
    if (tool === 'pencil') {
      canvasManager.enableFreeDrawing(stroke);
    } else if (tool === 'eraser') {
      canvasManager.enableEraser();
    } else {
      canvasManager.disableFreeDrawing();
    }

    // Image upload
    if (tool === 'image') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            canvasManager.addImage(ev.target?.result as string, 100, 100);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
      setActiveTool('select');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed left-4 top-1/2 -translate-y-1/2 z-50"
    >
      <div className="flex flex-col gap-1 p-2 rounded-2xl bg-white dark:bg-neutral-900 border border-border/50 shadow-2xl shadow-black/10 dark:shadow-black/30">
        {TOOLS.map((tool, idx) => (
          <div key={tool.id}>
            {/* Separator after select and before eraser */}
            {(idx === 1 || idx === TOOLS.length - 1) && (
              <Separator className="my-1 opacity-30" />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  id={`tool-${tool.id}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleToolClick(tool.id)}
                  className={`
                    relative flex items-center justify-center w-10 h-10 rounded-xl 
                    transition-all duration-200 ease-out
                    ${activeTool === tool.id
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/80'
                    }
                  `}
                >
                  {tool.icon}
                  {activeTool === tool.id && (
                    <motion.div
                      layoutId="activeToolIndicator"
                      className="absolute inset-0 rounded-xl bg-primary -z-10"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-2">
                <span>{tool.label}</span>
                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border/50">
                  {tool.shortcut}
                </kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
