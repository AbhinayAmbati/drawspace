'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useToolStore, useUIStore, useObjectsStore } from '@/stores';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Palette,
  Minus,
  CircleDot,
  X,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
} from 'lucide-react';
import { canvasManager } from '@/lib/canvas-manager';

const PRESET_COLORS = [
  '#1e1e1e', '#e03131', '#f76707', '#fcc419',
  '#40c057', '#228be6', '#7950f2', '#be4bdb',
  '#ffffff', '#868e96', '#495057', '#f8f9fa',
];

const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8];

export function PropertiesPanel() {
  const show = useUIStore((s) => s.showProperties);
  const toggleProperties = useUIStore((s) => s.toggleProperties);
  const {
    stroke, fill,
    setStrokeColor, setStrokeWidth, setStrokeOpacity, setStrokeDash,
    setFillColor, setFillOpacity,
  } = useToolStore();
  const selectedIds = useObjectsStore((s) => s.selectedIds);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed right-4 top-20 bottom-20 z-40 w-64"
        >
          <div className="h-full rounded-2xl bg-white dark:bg-neutral-900 border border-border/50 shadow-2xl shadow-black/10 dark:shadow-black/30 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <h3 className="text-sm font-semibold">Properties</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={toggleProperties}
              >
                <X size={14} />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Stroke Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Palette size={12} />
                    Stroke
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={`stroke-${color}`}
                        className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                          stroke.color === color ? 'border-primary shadow-md' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setStrokeColor(color)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-14">Color</Label>
                    <Input
                      type="color"
                      value={stroke.color}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className="h-8 w-10 p-0.5 rounded-lg cursor-pointer border-border/50"
                    />
                    <Input
                      type="text"
                      value={stroke.color}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className="h-8 flex-1 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Stroke Width */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Minus size={12} />
                    Width
                  </div>
                  <div className="flex items-center gap-1.5">
                    {STROKE_WIDTHS.map((w) => (
                      <button
                        key={`sw-${w}`}
                        className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs transition-all ${
                          stroke.width === w
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                        onClick={() => setStrokeWidth(w)}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stroke Style */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Style</div>
                  <div className="flex items-center gap-1.5">
                    <button
                      className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs transition-all ${
                        !stroke.dashArray?.length
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                      onClick={() => setStrokeDash([])}
                    >
                      Solid
                    </button>
                    <button
                      className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs transition-all ${
                        stroke.dashArray?.[0] === 8
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                      onClick={() => setStrokeDash([8, 4])}
                    >
                      Dashed
                    </button>
                    <button
                      className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs transition-all ${
                        stroke.dashArray?.[0] === 2
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                      onClick={() => setStrokeDash([2, 2])}
                    >
                      Dotted
                    </button>
                  </div>
                </div>

                {/* Opacity */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <CircleDot size={12} />
                      Opacity
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(stroke.opacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[stroke.opacity * 100]}
                    onValueChange={([v]) => setStrokeOpacity(v / 100)}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                <Separator className="opacity-30" />

                {/* Fill Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Palette size={12} />
                    Fill
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    <button
                      className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 relative ${
                        fill.color === 'transparent' ? 'border-primary shadow-md' : 'border-transparent'
                      } bg-white dark:bg-gray-800`}
                      onClick={() => setFillColor('transparent')}
                    >
                      <div className="absolute inset-1 border-t-2 border-red-500 rotate-45 origin-center" />
                    </button>
                    {PRESET_COLORS.slice(0, -1).map((color) => (
                      <button
                        key={`fill-${color}`}
                        className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                          fill.color === color ? 'border-primary shadow-md' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFillColor(color)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-14">Color</Label>
                    <Input
                      type="color"
                      value={fill.color === 'transparent' ? '#ffffff' : fill.color}
                      onChange={(e) => setFillColor(e.target.value)}
                      className="h-8 w-10 p-0.5 rounded-lg cursor-pointer border-border/50"
                    />
                    <Input
                      type="text"
                      value={fill.color}
                      onChange={(e) => setFillColor(e.target.value)}
                      className="h-8 flex-1 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Fill Opacity */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fill Opacity</span>
                    <span className="text-xs text-muted-foreground">{Math.round(fill.opacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[fill.opacity * 100]}
                    onValueChange={([v]) => setFillOpacity(v / 100)}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Selection actions */}
                {selectedIds.size > 0 && (
                  <>
                    <Separator className="opacity-30" />
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions ({selectedIds.size} selected)
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => canvasManager.duplicateSelected()}>
                          <Copy size={12} className="mr-1" /> Duplicate
                        </Button>
                        <Button variant="destructive" size="sm" className="text-xs h-8" onClick={() => canvasManager.deleteSelected()}>
                          <Trash2 size={12} className="mr-1" /> Delete
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { icon: <ChevronsUp size={14} />, label: 'To Front', action: () => selectedIds.forEach((id) => useObjectsStore.getState().bringToFront(id)) },
                          { icon: <ArrowUp size={14} />, label: 'Forward', action: () => selectedIds.forEach((id) => useObjectsStore.getState().bringForward(id)) },
                          { icon: <ArrowDown size={14} />, label: 'Backward', action: () => selectedIds.forEach((id) => useObjectsStore.getState().sendBackward(id)) },
                          { icon: <ChevronsDown size={14} />, label: 'To Back', action: () => selectedIds.forEach((id) => useObjectsStore.getState().sendToBack(id)) },
                        ].map((btn) => (
                          <Button key={btn.label} variant="outline" size="icon" className="h-8 w-full rounded-lg" onClick={btn.action} title={btn.label}>
                            {btn.icon}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
