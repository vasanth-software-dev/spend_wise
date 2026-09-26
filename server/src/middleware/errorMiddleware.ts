import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: Error & { statusCode?: number; code?: string; errors?: unknown[] },
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred';
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  logger.error(`[${req.method}] ${req.originalUrl} - ${message}`, err.stack);

  sendError(res, message, statusCode, code, err.errors);
}
