import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from project root or server dir
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  // Comma-separated extra frontend origins (e.g. ngrok client URL) allowed for CORS.
  // Example: CLIENT_URLS=https://abc123.ngrok-free.app,https://def456.ngrok-free.app
  CLIENT_URLS: z.string().optional(),
  // Public base URL of the backend itself (e.g. https://<backend-ngrok>.ngrok-free.app).
  // Used to build absolute OAuth redirect_uris when behind ngrok.
  // If unset, falls back to GOOGLE_*_REDIRECT_URI values.
  PUBLIC_API_URL: z.string().optional(),
  MONGO_URI: z.string().default('mongodb://localhost:27017/spendwise'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().default('spendwise_super_secret_access_token_key_change_in_production_min32chars'),
  JWT_REFRESH_SECRET: z.string().default('spendwise_super_secret_refresh_token_key_change_in_production_min32chars'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:8080/api/v1/email-accounts/gmail/callback'),
  GOOGLE_AUTH_REDIRECT_URI: z.string().default('http://localhost:8080/api/v1/auth/google/callback'),
  INBOUND_FORWARDING_DOMAIN: z.string().default('sync.spendwise.local'),
  INBOUND_WEBHOOK_SECRET: z.string().optional(),
OPENAI_API_KEY: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_API_URL: z.string().url().default('https://api.openai.com/v1/chat/completions'),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().max(60000).default(8000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;

// All allowed frontend origins (primary CLIENT_URL + extras from CLIENT_URLS).
export function getAllowedClientOrigins(): string[] {
  const extras = (env.CLIENT_URLS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [env.CLIENT_URL.replace(/\/$/, ''), ...extras];
}

// Resolve the public base URL of the backend (ngrok URL when set).
export function getPublicApiBase(): string | null {
  const raw = (env.PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
  return raw ? raw : null;
}
