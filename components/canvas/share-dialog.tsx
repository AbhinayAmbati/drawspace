'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useUIStore, useCollaborationStore } from '@/stores';
import { collaborationManager } from '@/lib/collaboration';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Copy,
  Check,
  Link2,
  Users,
  Globe,
  Lock,
  LogIn,
  LogOut,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const NAMES = ['Phoenix', 'Atlas', 'Nova', 'Zen', 'Echo', 'Flux', 'Pixel', 'Orbit', 'Prism', 'Spark'];
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

function getRandomName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function ShareDialog() {
  const { showShareDialog, setShowShareDialog } = useUIStore();
  const { roomId, isConnected, connectionStatus, userName, userColor, collaborators } = useCollaborationStore();
  const [roomInput, setRoomInput] = useState('');
  const [nameInput, setNameInput] = useState(() => getRandomName());
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  const handleCreateRoom = useCallback(() => {
    const newRoomId = uuidv4().slice(0, 8);
    const userId = uuidv4();
    const name = nameInput || getRandomName();
    const color = getRandomColor();

    collaborationManager.connect(newRoomId, userId, name, color);
    setRoomInput(newRoomId);
  }, [nameInput]);

  const handleJoinRoom = useCallback(() => {
    if (!roomInput.trim()) return;
    const userId = uuidv4();
    const name = nameInput || getRandomName();
    const color = getRandomColor();

    collaborationManager.connect(roomInput.trim(), userId, name, color);
  }, [roomInput, nameInput]);

  const handleDisconnect = useCallback(() => {
    collaborationManager.disconnect();
    setRoomInput('');
  }, []);

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  return (
    <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
      <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={18} className="text-violet-500" />
            Collaborate
          </DialogTitle>
          <DialogDescription>
            Share your board or join an existing session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Connection Status */}
          {isConnected && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                Connected to room: {roomId}
              </span>
            </motion.div>
          )}

          {!isConnected && (
            <>
              {/* Name input */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Your Name</Label>
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name..."
                  className="rounded-xl"
                />
              </div>

              {/* Create or Join */}
              <div className="space-y-3">
                <Button
                  onClick={handleCreateRoom}
                  className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/20 hover:shadow-lg h-10"
                >
                  <Globe size={16} className="mr-2" />
                  Create New Room
                </Button>

                <div className="flex items-center gap-3">
                  <Separator className="flex-1 opacity-30" />
                  <span className="text-xs text-muted-foreground">or join existing</span>
                  <Separator className="flex-1 opacity-30" />
                </div>

                <div className="flex gap-2">
                  <Input
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="Enter room ID..."
                    className="rounded-xl"
                  />
                  <Button
                    onClick={handleJoinRoom}
                    variant="outline"
                    className="rounded-xl shrink-0"
                    disabled={!roomInput.trim()}
                  >
                    <LogIn size={16} className="mr-1" />
                    Join
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Connected state */}
          {isConnected && (
            <>
              {/* Share link */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Share Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}?room=${roomId}`}
                    readOnly
                    className="rounded-xl text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl shrink-0"
                    onClick={handleCopyLink}
                  >
                    {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>

              {/* Active Users */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Active Users ({collaborators.size + 1})
                </Label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {/* Current user */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/50">
                    <div
                      className="w-3 h-3 rounded-full ring-2 ring-white dark:ring-gray-800"
                      style={{ backgroundColor: userColor }}
                    />
                    <span className="text-sm font-medium">{userName}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px] h-5">You</Badge>
                  </div>
                  {/* Collaborators */}
                  {Array.from(collaborators.values()).map((collab) => (
                    <div
                      key={collab.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-accent/30 transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded-full ring-2 ring-white dark:ring-gray-800"
                        style={{ backgroundColor: collab.color }}
                      />
                      <span className="text-sm">{collab.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disconnect */}
              <Button
                variant="outline"
                className="w-full rounded-xl text-destructive hover:text-destructive"
                onClick={handleDisconnect}
              >
                <LogOut size={16} className="mr-2" />
                Leave Room
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
