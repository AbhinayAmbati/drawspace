/**
 * DrawSpace WebSocket Server
 * 
 * Standalone y-websocket server for Yjs CRDT synchronization.
 * Handles:
 * - Room-based document sync
 * - Awareness (cursor/presence) broadcasting
 * - Heartbeat & reconnection
 * - Efficient binary message encoding
 * 
 * Deployment: Run separately from the Next.js app.
 * - Development: node ws-server/index.js
 * - Production: Deploy on Railway, Render, or Fly.io
 */

const { setupWSConnection } = require('y-websocket/bin/utils');
const http = require('http');
const { WebSocketServer } = require('ws');

// ============================================================
// Configuration
// ============================================================

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '1234', 10);

// ============================================================
// HTTP Server
// ============================================================

const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'drawspace-ws',
      uptime: process.uptime(),
      connections: wss?.clients?.size || 0,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  res.writeHead(404);
  res.end();
});

// ============================================================
// WebSocket Server
// ============================================================

const wss = new WebSocketServer({ server });

// Track rooms and connections for logging
const rooms = new Map();

wss.on('connection', (ws, req) => {
  const roomName = req.url?.slice(1).split('?')[0] || 'default';
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  console.log(`[WS] Client connected to room "${roomName}" from ${clientIP}`);
  console.log(`[WS] Active connections: ${wss.clients.size}`);

  // Track room
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName).add(ws);

  // Setup Yjs WebSocket connection
  // This handles document sync, awareness, and message routing
  setupWSConnection(ws, req, {
    docName: roomName,
    gc: true, // Enable garbage collection for deleted content
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected from room "${roomName}"`);
    
    const roomClients = rooms.get(roomName);
    if (roomClients) {
      roomClients.delete(ws);
      if (roomClients.size === 0) {
        rooms.delete(roomName);
        console.log(`[WS] Room "${roomName}" is now empty, cleaning up`);
      }
    }
    
    console.log(`[WS] Active connections: ${wss.clients.size}`);
  });

  ws.on('error', (error) => {
    console.error(`[WS] Error in room "${roomName}":`, error.message);
  });
});

// ============================================================
// Periodic cleanup & stats
// ============================================================

setInterval(() => {
  const stats = {
    connections: wss.clients.size,
    rooms: rooms.size,
    roomDetails: Object.fromEntries(
      [...rooms.entries()].map(([name, clients]) => [name, clients.size])
    ),
  };
  
  if (stats.connections > 0) {
    console.log(`[WS] Stats:`, JSON.stringify(stats));
  }
}, 60000); // Every minute

// ============================================================
// Start Server
// ============================================================

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   DrawSpace WebSocket Server             ║');
  console.log(`  ║   Running on ws://${HOST}:${PORT}        ║`);
  console.log('  ║   Health: http://localhost:' + PORT + '/health    ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[WS] Shutting down...');
  wss.clients.forEach((ws) => ws.close());
  server.close(() => {
    console.log('[WS] Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[WS] SIGTERM received, shutting down...');
  wss.clients.forEach((ws) => ws.close());
  server.close(() => process.exit(0));
});
