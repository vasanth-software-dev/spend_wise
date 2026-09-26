import { Schema, model } from 'mongoose';
import { IUser } from '../types/index.js';

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    avatar: { type: String },
    passwordHash: { type: String, required: false },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, sparse: true, index: true },
    isEmailVerified: { type: Boolean, default: true }, // Set true for local development ease
    currency: { type: String, default: 'INR', uppercase: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
  },
  {
    timestamps: true,
  }
);

export const UserModel = model<IUser>('User', userSchema);
