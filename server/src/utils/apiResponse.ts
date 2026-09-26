import { Response } from 'express';
import { ApiResponse } from '../types/index.js';

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200,
  pagination?: ApiResponse<T>['pagination']
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    ...(pagination ? { pagination } : {}),
  };
  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  code?: string,
  errors?: unknown[]
): Response {
  const response: ApiResponse = {
    success: false,
    message,
    code: code || 'ERROR',
    ...(errors && errors.length ? { errors } : {}),
  };
  return res.status(statusCode).json(response);
}
