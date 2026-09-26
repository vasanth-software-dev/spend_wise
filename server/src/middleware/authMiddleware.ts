import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { sendError } from '../utils/apiResponse.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    sessionId: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authentication required. No access token provided.', 401, 'UNAUTHORIZED');
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    sendError(res, 'Access token is invalid or has expired', 401, 'TOKEN_EXPIRED');
  }
}
