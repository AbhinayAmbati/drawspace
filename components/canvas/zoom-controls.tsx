'use client';

import { motion } from 'framer-motion';
import { useCanvasStore } from '@/stores';
import { canvasManager } from '@/lib/canvas-manager';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
} from 'lucide-react';

export function ZoomControls() {
  const viewport = useCanvasStore((s) => s.viewport);
  const zoomPercent = Math.round(viewport.zoom * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-white dark:bg-neutral-900 border border-border/50 shadow-lg shadow-black/5 dark:shadow-black/20">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => canvasManager.zoomOut()}
            >
              <ZoomOut size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out (Ctrl+-)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="min-w-[52px] h-8 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors"
              onClick={() => canvasManager.resetView()}
            >
              {zoomPercent}%
            </button>
          </TooltipTrigger>
          <TooltipContent>Reset Zoom (Ctrl+0)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => canvasManager.zoomIn()}
            >
              <ZoomIn size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In (Ctrl++)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 opacity-30" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => canvasManager.zoomToFit()}
            >
              <Maximize2 size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom to Fit (Ctrl+Shift+1)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => canvasManager.resetView()}
            >
              <RotateCcw size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset View</TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  );
}
