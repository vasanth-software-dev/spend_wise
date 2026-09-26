import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB connected successfully to: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
}
