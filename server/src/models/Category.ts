import { Schema, model } from 'mongoose';
import { ICategory } from '../types/index.js';

const categorySchema = new Schema<ICategory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['expense', 'income', 'both'], default: 'expense' },
    icon: { type: String, default: 'Tag' },
    color: { type: String, default: '#64748b' },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ userId: 1, name: 1 }, { unique: true });

export const CategoryModel = model<ICategory>('Category', categorySchema);
