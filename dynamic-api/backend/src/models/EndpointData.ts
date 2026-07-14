import mongoose, { Document, Schema } from 'mongoose';

export interface IEndpointData extends Document {
  endpointId: mongoose.Types.ObjectId;
  resourcePath: string;
  data: Record<string, unknown>;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EndpointDataSchema = new Schema<IEndpointData>(
  {
    endpointId: { type: Schema.Types.ObjectId, ref: 'Endpoint', required: true, index: true },
    resourcePath: { type: String, required: true, index: true },
    data: { type: Schema.Types.Mixed, required: true, default: {} },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

EndpointDataSchema.index({ resourcePath: 1, createdAt: -1 });
EndpointDataSchema.index({ endpointId: 1, createdAt: -1 });
EndpointDataSchema.index({ resourcePath: 1, 'data.postSerial': 1, 'data.receivedAt': -1 });
EndpointDataSchema.index({
  resourcePath: 1,
  'data.postSerial': 1,
  'data.messageType': 1,
  'data.receivedAt': -1,
});
EndpointDataSchema.index({ resourcePath: 1, 'data.postId': 1, 'data.lastMessageAt': -1 });
EndpointDataSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EndpointData = mongoose.model<IEndpointData>('EndpointData', EndpointDataSchema);
