import mongoose, { Document, Schema } from 'mongoose';
import { LogAction } from '../types';

export interface ILog extends Document {
  action: LogAction;
  userId?: mongoose.Types.ObjectId;
  endpointId?: mongoose.Types.ObjectId;
  message: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  statusCode?: number;
  responseTime?: number;
  createdAt: Date;
}

const LogSchema = new Schema<ILog>(
  {
    action: {
      type: String,
      enum: [
        'login', 'logout', 'register', 'error',
        'endpoint_create', 'endpoint_update', 'endpoint_delete',
        'api_call', 'user_create', 'user_update', 'user_delete',
      ],
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    endpointId: { type: Schema.Types.ObjectId, ref: 'Endpoint' },
    message: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
    statusCode: { type: Number },
    responseTime: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

LogSchema.index({ createdAt: -1 });

export const Log = mongoose.model<ILog>('Log', LogSchema);
