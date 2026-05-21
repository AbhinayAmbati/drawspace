'use client';

import dynamic from 'next/dynamic';

/**
 * Dynamic import of the whiteboard view with SSR disabled.
 * Fabric.js requires browser APIs (canvas, window) that aren't
 * available during server-side rendering.
 */
const WhiteboardView = dynamic(
  () => import('@/components/whiteboard-view').then((mod) => mod.WhiteboardView),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          {/* Animated logo */}
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/30 animate-pulse">
              <span className="text-white text-2xl font-bold">D</span>
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 blur-lg -z-10 animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-lg font-semibold text-foreground">DrawSpace</h1>
            <p className="text-sm text-muted-foreground">Loading your canvas...</p>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-violet-500"
                style={{
                  animation: `bounce 1.4s infinite ease-in-out both`,
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  return <WhiteboardView />;
}
