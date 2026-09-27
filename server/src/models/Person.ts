import { Schema, model } from 'mongoose';
import { IPerson } from '../types/index.js';

const personSchema = new Schema<IPerson>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true },
    vpa: { type: String, trim: true, lowercase: true },
    email: { type: String, trim: true, lowercase: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

personSchema.index(
  { userId: 1, vpa: 1 },
  { unique: true, partialFilterExpression: { vpa: { $type: 'string' } } }
);
personSchema.index(
  { userId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
personSchema.index({ userId: 1, normalizedName: 1 });
personSchema.index({ userId: 1, isDeleted: 1 });

export const PersonModel = model<IPerson>('Person', personSchema);

