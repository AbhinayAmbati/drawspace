/**
 * API Route: /api/rooms
 * 
 * GET  — List active rooms
 * POST — Create/join a room
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Room, CollaborationSession } from '@/lib/models';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    await connectDB();

    const rooms = await Room.find({ isActive: true })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ success: true, data: rooms });
  } catch (error) {
    console.error('[API] GET /api/rooms error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { whiteboardId, userId, userName, userColor, isPublic } = body;

    if (!whiteboardId || !userId) {
      return NextResponse.json(
        { success: false, error: 'whiteboardId and userId are required' },
        { status: 400 }
      );
    }

    // Check if an active room already exists for this whiteboard
    let room = await Room.findOne({
      whiteboardId,
      isActive: true,
    });

    if (room) {
      // Add user to existing room if not already present
      const userExists = room.activeUsers.some((u) => u.userId === userId);
      if (!userExists) {
        room.activeUsers.push({
          userId,
          name: userName || 'Anonymous',
          color: userColor || '#3b82f6',
          joinedAt: new Date(),
        });
        await room.save();
      }
    } else {
      // Create new room
      room = await Room.create({
        roomId: uuidv4(),
        whiteboardId,
        isPublic: isPublic ?? true,
        activeUsers: [
          {
            userId,
            name: userName || 'Anonymous',
            color: userColor || '#3b82f6',
            joinedAt: new Date(),
          },
        ],
      });

      // Create collaboration session
      await CollaborationSession.create({
        roomId: room.roomId,
        whiteboardId,
        participants: [
          {
            userId,
            name: userName || 'Anonymous',
            joinedAt: new Date(),
          },
        ],
      });
    }

    return NextResponse.json({ success: true, data: room }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/rooms error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create/join room' },
      { status: 500 }
    );
  }
}
