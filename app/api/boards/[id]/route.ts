/**
 * API Route: /api/boards/[id]
 * 
 * GET    — Get a single board by ID
 * PUT    — Update a board
 * DELETE — Delete a board
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Whiteboard, Snapshot, Activity } from '@/lib/models';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;

    const board = await Whiteboard.findById(id).lean();
    if (!board) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: board });
  } catch (error) {
    console.error('[API] GET /api/boards/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch board' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;
    const body = await request.json();

    // If canvasJSON is being updated, create a snapshot first
    if (body.canvasJSON) {
      const existing = await Whiteboard.findById(id).select('version').lean();
      if (existing) {
        await Snapshot.create({
          whiteboardId: id,
          version: (existing as any).version || 1,
          canvasJSON: body.canvasJSON,
          createdBy: body.userId,
        });
        body.version = ((existing as any).version || 1) + 1;
      }
    }

    const board = await Whiteboard.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!board) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    // Log activity
    if (body.userId) {
      await Activity.create({
        whiteboardId: id,
        userId: body.userId,
        action: 'edited',
      });
    }

    return NextResponse.json({ success: true, data: board });
  } catch (error) {
    console.error('[API] PUT /api/boards/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update board' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;

    const board = await Whiteboard.findByIdAndDelete(id);
    if (!board) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    // Clean up related snapshots
    await Snapshot.deleteMany({ whiteboardId: id });

    return NextResponse.json({ success: true, message: 'Board deleted' });
  } catch (error) {
    console.error('[API] DELETE /api/boards/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete board' },
      { status: 500 }
    );
  }
}
