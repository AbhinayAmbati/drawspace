/**
 * API Route: /api/boards/[id]/snapshots
 * 
 * GET  — List all snapshots for a board
 * POST — Create a new snapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Snapshot } from '@/lib/models';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;

    const snapshots = await Snapshot.find({ whiteboardId: id })
      .sort({ version: -1 })
      .select('-canvasJSON') // Exclude heavy data for listing
      .limit(50)
      .lean();

    return NextResponse.json({ success: true, data: snapshots });
  } catch (error) {
    console.error('[API] GET snapshots error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;
    const body = await request.json();

    const lastSnapshot = await Snapshot.findOne({ whiteboardId: id })
      .sort({ version: -1 })
      .select('version')
      .lean();

    const nextVersion = ((lastSnapshot as any)?.version || 0) + 1;

    const snapshot = await Snapshot.create({
      whiteboardId: id,
      version: nextVersion,
      canvasJSON: body.canvasJSON,
      metadata: body.metadata,
      createdBy: body.userId,
    });

    return NextResponse.json({ success: true, data: snapshot }, { status: 201 });
  } catch (error) {
    console.error('[API] POST snapshots error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create snapshot' },
      { status: 500 }
    );
  }
}
