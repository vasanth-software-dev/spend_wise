import mongoose from 'mongoose';
import { env } from './env.js';

let cachedPromise: Promise<typeof mongoose> | null = null;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!cachedPromise) {
    mongoose.set('strictQuery', true);
    cachedPromise = mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    }).catch((err) => {
      cachedPromise = null;
      throw err;
    });
  }

  try {
    const conn = await cachedPromise;
    console.log(`✅ MongoDB connected successfully to: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  cachedPromise = null;
  console.log('MongoDB disconnected');
}

