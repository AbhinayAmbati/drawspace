/**
 * API Route: /api/boards
 * 
 * GET  — List all boards (with optional pagination)
 * POST — Create a new board
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Whiteboard, Activity } from '@/lib/models';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const [boards, total] = await Promise.all([
      Whiteboard.find()
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-canvasJSON') // Exclude heavy payload for listing
        .lean(),
      Whiteboard.countDocuments(),
    ]);

    return NextResponse.json({
      success: true,
      data: boards,
      total,
      page,
      limit,
      hasMore: skip + boards.length < total,
    });
  } catch (error) {
    console.error('[API] GET /api/boards error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch boards' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { name, description, isPublic, ownerId, canvasJSON, tags } = body;

    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'ownerId is required' },
        { status: 400 }
      );
    }

    const board = await Whiteboard.create({
      name: name || 'Untitled Board',
      description,
      isPublic: isPublic ?? false,
      ownerId,
      canvasJSON: canvasJSON || '{}',
      tags: tags || [],
    });

    // Log activity
    await Activity.create({
      whiteboardId: board._id,
      userId: ownerId,
      action: 'created',
      details: `Board "${board.name}" created`,
    });

    return NextResponse.json({ success: true, data: board }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/boards error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create board' },
      { status: 500 }
    );
  }
}
