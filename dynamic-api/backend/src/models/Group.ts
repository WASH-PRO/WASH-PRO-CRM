import mongoose, { Document, Schema } from 'mongoose';
import { Permission } from '../types';

export interface IGroup extends Document {
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    permissions: {
      type: [String],
      enum: ['view', 'create', 'update', 'delete', 'manage_users', 'manage_api', 'view_logs'],
      default: ['view'],
    },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Group = mongoose.model<IGroup>('Group', GroupSchema);
