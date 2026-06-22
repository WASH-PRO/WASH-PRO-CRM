import mongoose, { Document, Schema } from 'mongoose';

export interface IEndpointGroup extends Document {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const EndpointGroupSchema = new Schema<IEndpointGroup>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    icon: { type: String, default: 'folder' },
    color: { type: String, default: '#3b82f6' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const EndpointGroup = mongoose.model<IEndpointGroup>('EndpointGroup', EndpointGroupSchema);
