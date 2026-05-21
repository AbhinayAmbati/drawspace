'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore, useObjectsStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import {
  X,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react';

export function LayersPanel() {
  const show = useUIStore((s) => s.showLayers);
  const toggleLayers = useUIStore((s) => s.toggleLayers);
  const {
    layers, activeLayerId,
    addLayer, removeLayer, updateLayer, setActiveLayer,
  } = useObjectsStore();

  const handleAddLayer = () => {
    const newLayer = {
      id: uuidv4(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      objectIds: [],
      order: layers.length,
    };
    addLayer(newLayer);
    setActiveLayer(newLayer.id);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed left-20 top-20 bottom-20 z-40 w-56"
        >
          <div className="h-full rounded-2xl bg-white dark:bg-neutral-900 border border-border/50 shadow-2xl shadow-black/10 dark:shadow-black/30 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <h3 className="text-sm font-semibold">Layers</h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={handleAddLayer}
                >
                  <Plus size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={toggleLayers}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {[...layers].reverse().map((layer) => (
                  <motion.div
                    key={layer.id}
                    layout
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all
                      ${activeLayerId === layer.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-accent/50 border border-transparent'
                      }
                    `}
                    onClick={() => setActiveLayer(layer.id)}
                  >
                    <GripVertical size={12} className="text-muted-foreground/40 cursor-grab" />

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{layer.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {layer.objectIds.length} object{layer.objectIds.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateLayer(layer.id, { visible: !layer.visible });
                        }}
                      >
                        {layer.visible ? <Eye size={12} /> : <EyeOff size={12} className="text-muted-foreground" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateLayer(layer.id, { locked: !layer.locked });
                        }}
                      >
                        {layer.locked ? <Lock size={12} className="text-amber-500" /> : <Unlock size={12} className="text-muted-foreground" />}
                      </Button>
                      {layers.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded text-destructive/60 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLayer(layer.id);
                          }}
                        >
                          <Trash2 size={12} />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
