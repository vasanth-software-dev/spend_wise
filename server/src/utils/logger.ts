const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'encryptedAccessToken',
  'encryptedRefreshToken',
  'secret',
  'authorization',
  'cookie',
  'otp',
  'pin',
  'cvv',
];

export function maskSensitiveData(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveData);
  }

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export const logger = {
  info: (message: string, meta?: unknown) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta ? maskSensitiveData(meta) : '');
  },
  warn: (message: string, meta?: unknown) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta ? maskSensitiveData(meta) : '');
  },
  error: (message: string, error?: unknown) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error instanceof Error ? error.message : error);
  },
  debug: (message: string, meta?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta ? maskSensitiveData(meta) : '');
    }
  },
};
