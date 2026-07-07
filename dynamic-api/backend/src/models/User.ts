import mongoose, { Document, Schema } from 'mongoose';
import { UserStatus } from '../types';

export interface IUser extends Document {
  login: string;
  email: string;
  password: string;
  name: string;
  status: UserStatus;
  groupIds: mongoose.Types.ObjectId[];
  telegramUserId?: number;
  refreshToken?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    login: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    groupIds: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
    telegramUserId: { type: Number, unique: true, sparse: true, index: true },
    refreshToken: { type: String },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
