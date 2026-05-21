'use client';

import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useUIStore, useHistoryStore, useCanvasStore, useCollaborationStore } from '@/stores';
import { canvasManager } from '@/lib/canvas-manager';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Undo2,
  Redo2,
  Download,
  Share2,
  Menu,
  Sun,
  Moon,
  Monitor,
  Grid3x3,
  Layers,
  Settings,
  FileJson,
  Image as ImageIcon,
  FileCode,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Wifi,
  WifiOff,
  Users,
  PanelRight,
  Ruler,
  Magnet,
} from 'lucide-react';

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const { undo, redo, canUndo, canRedo } = useHistoryStore();
  const { toggleGrid, toggleSnapToGrid, toggleRulers, settings } = useCanvasStore();
  const {
    setShowExportDialog, setShowShareDialog, setShowSettingsDialog,
    toggleProperties, toggleLayers, showProperties, showLayers,
  } = useUIStore();
  const { isConnected, connectionStatus, collaborators } = useCollaborationStore();

  const handleUndo = () => {
    const snapshot = undo();
    if (snapshot) canvasManager.loadFromJSON(snapshot);
  };

  const handleRedo = () => {
    const snapshot = redo();
    if (snapshot) canvasManager.loadFromJSON(snapshot);
  };

  const handleExportPNG = () => {
    const dataUrl = canvasManager.exportToPNG();
    const link = document.createElement('a');
    link.download = 'drawspace-export.png';
    link.href = dataUrl;
    link.click();
  };

  const handleExportSVG = () => {
    const svg = canvasManager.exportToSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'drawspace-export.svg';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const json = canvasManager.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'drawspace-export.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const json = ev.target?.result as string;
          canvasManager.loadFromJSON(json);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 h-14"
    >
      <div className="mx-4 mt-3 flex items-center justify-between rounded-2xl bg-white dark:bg-neutral-900 border border-border/50 shadow-lg shadow-black/5 dark:shadow-black/20 px-3 h-12">
        {/* Left: Logo + Menu */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 font-semibold text-sm">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">D</span>
                </div>
                DrawSpace
                <Menu size={14} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Download size={14} className="mr-2" />
                  Export
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={handleExportPNG}>
                    <ImageIcon size={14} className="mr-2" /> Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportSVG}>
                    <FileCode size={14} className="mr-2" /> Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJSON}>
                    <FileJson size={14} className="mr-2" /> Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={handleImportJSON}>
                <Upload size={14} className="mr-2" /> Import JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleGrid}>
                <Grid3x3 size={14} className="mr-2" />
                {settings.grid.enabled ? 'Hide Grid' : 'Show Grid'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleSnapToGrid}>
                <Magnet size={14} className="mr-2" />
                {settings.grid.snapToGrid ? 'Disable Snap' : 'Enable Snap'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleRulers}>
                <Ruler size={14} className="mr-2" />
                {settings.showRulers ? 'Hide Rulers' : 'Show Rulers'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {theme === 'dark' ? <Moon size={14} className="mr-2" /> : <Sun size={14} className="mr-2" />}
                  Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => setTheme('light')}>
                    <Sun size={14} className="mr-2" /> Light
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <Moon size={14} className="mr-2" /> Dark
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')}>
                    <Monitor size={14} className="mr-2" /> System
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSettingsDialog(true)}>
                <Settings size={14} className="mr-2" /> Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6 opacity-30" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  disabled={!canUndo}
                  onClick={handleUndo}
                >
                  <Undo2 size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span>Undo</span>
                <kbd className="ml-2 px-1 py-0.5 rounded text-[10px] font-mono bg-muted border border-border/50">Ctrl+Z</kbd>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  disabled={!canRedo}
                  onClick={handleRedo}
                >
                  <Redo2 size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span>Redo</span>
                <kbd className="ml-2 px-1 py-0.5 rounded text-[10px] font-mono bg-muted border border-border/50">Ctrl+Shift+Z</kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Center: Board Name (placeholder) */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Untitled Board</span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Connection status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg">
                {isConnected ? (
                  <Wifi size={14} className="text-emerald-500" />
                ) : (
                  <WifiOff size={14} className="text-muted-foreground" />
                )}
                {collaborators.size > 0 && (
                  <Badge variant="secondary" className="h-5 text-[10px] px-1.5 rounded-full">
                    {collaborators.size}
                  </Badge>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isConnected ? 'Connected' : `Status: ${connectionStatus}`}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 opacity-30" />

          {/* Toggle panels */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showLayers ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={toggleLayers}
              >
                <Layers size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Layers</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showProperties ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={toggleProperties}
              >
                <PanelRight size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Properties</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 opacity-30" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setShowShareDialog(true)}
              >
                <Share2 size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share</TooltipContent>
          </Tooltip>

          <Button
            size="sm"
            className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all h-8 px-4 text-xs font-medium"
            onClick={handleExportPNG}
          >
            <Download size={14} className="mr-1.5" />
            Export
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
