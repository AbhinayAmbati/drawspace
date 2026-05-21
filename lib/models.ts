/**
 * Mongoose schemas for all application entities.
 */

import mongoose, { Schema, type Document, type Model } from 'mongoose';

// ============================================================
// User Schema
// ============================================================

export interface IUser extends Document {
  name: string;
  email?: string;
  avatar?: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    avatar: { type: String },
    color: { type: String, required: true, default: '#3b82f6' },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });

// ============================================================
// Whiteboard Schema
// ============================================================

export interface IWhiteboard extends Document {
  name: string;
  description?: string;
  thumbnail?: string;
  ownerId: mongoose.Types.ObjectId;
  isPublic: boolean;
  tags: string[];
  collaboratorIds: mongoose.Types.ObjectId[];
  canvasJSON: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const WhiteboardSchema = new Schema<IWhiteboard>(
  {
    name: { type: String, required: true, trim: true, default: 'Untitled Board' },
    description: { type: String, trim: true },
    thumbnail: { type: String },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isPublic: { type: Boolean, default: false },
    tags: [{ type: String, trim: true }],
    collaboratorIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    canvasJSON: { type: String, default: '{}' },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

WhiteboardSchema.index({ ownerId: 1, updatedAt: -1 });
WhiteboardSchema.index({ isPublic: 1, updatedAt: -1 });
WhiteboardSchema.index({ tags: 1 });

// ============================================================
// Room Schema
// ============================================================

export interface IRoom extends Document {
  roomId: string;
  whiteboardId: mongoose.Types.ObjectId;
  isActive: boolean;
  isPublic: boolean;
  maxUsers: number;
  activeUsers: {
    userId: string;
    name: string;
    color: string;
    joinedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    whiteboardId: { type: Schema.Types.ObjectId, ref: 'Whiteboard', required: true },
    isActive: { type: Boolean, default: true },
    isPublic: { type: Boolean, default: true },
    maxUsers: { type: Number, default: 20 },
    activeUsers: [
      {
        userId: { type: String, required: true },
        name: { type: String, required: true },
        color: { type: String, required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

RoomSchema.index({ whiteboardId: 1 });
RoomSchema.index({ isActive: 1 });

// ============================================================
// Snapshot Schema (board versioning)
// ============================================================

export interface ISnapshot extends Document {
  whiteboardId: mongoose.Types.ObjectId;
  version: number;
  canvasJSON: string;
  metadata?: Record<string, unknown>;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const SnapshotSchema = new Schema<ISnapshot>(
  {
    whiteboardId: { type: Schema.Types.ObjectId, ref: 'Whiteboard', required: true, index: true },
    version: { type: Number, required: true },
    canvasJSON: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

SnapshotSchema.index({ whiteboardId: 1, version: -1 });

// ============================================================
// Collaboration Session Schema
// ============================================================

export interface ICollaborationSession extends Document {
  roomId: string;
  whiteboardId: mongoose.Types.ObjectId;
  participants: {
    userId: string;
    name: string;
    joinedAt: Date;
    leftAt?: Date;
  }[];
  startedAt: Date;
  endedAt?: Date;
  totalEdits: number;
}

const CollaborationSessionSchema = new Schema<ICollaborationSession>(
  {
    roomId: { type: String, required: true, index: true },
    whiteboardId: { type: Schema.Types.ObjectId, ref: 'Whiteboard', required: true },
    participants: [
      {
        userId: { type: String, required: true },
        name: { type: String, required: true },
        joinedAt: { type: Date, default: Date.now },
        leftAt: { type: Date },
      },
    ],
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    totalEdits: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CollaborationSessionSchema.index({ whiteboardId: 1, startedAt: -1 });

// ============================================================
// Activity History Schema
// ============================================================

export interface IActivity extends Document {
  whiteboardId: mongoose.Types.ObjectId;
  userId: string;
  action: 'created' | 'edited' | 'shared' | 'exported' | 'snapshot' | 'deleted';
  details?: string;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    whiteboardId: { type: Schema.Types.ObjectId, ref: 'Whiteboard', required: true, index: true },
    userId: { type: String, required: true },
    action: {
      type: String,
      enum: ['created', 'edited', 'shared', 'exported', 'snapshot', 'deleted'],
      required: true,
    },
    details: { type: String },
  },
  { timestamps: true }
);

ActivitySchema.index({ whiteboardId: 1, createdAt: -1 });

// ============================================================
// Model Exports (prevent re-compilation in development)
// ============================================================

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export const Whiteboard: Model<IWhiteboard> =
  mongoose.models.Whiteboard || mongoose.model<IWhiteboard>('Whiteboard', WhiteboardSchema);

export const Room: Model<IRoom> =
  mongoose.models.Room || mongoose.model<IRoom>('Room', RoomSchema);

export const Snapshot: Model<ISnapshot> =
  mongoose.models.Snapshot || mongoose.model<ISnapshot>('Snapshot', SnapshotSchema);

export const CollaborationSession: Model<ICollaborationSession> =
  mongoose.models.CollaborationSession ||
  mongoose.model<ICollaborationSession>('CollaborationSession', CollaborationSessionSchema);

export const Activity: Model<IActivity> =
  mongoose.models.Activity || mongoose.model<IActivity>('Activity', ActivitySchema);
