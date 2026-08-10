import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import type { ApiError } from '../types/shared.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response<ApiError>,
  next: NextFunction
): void {
  console.error(err.stack || err);
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  res.status(statusCode).json({ error: err.message || 'Internal server error' });
}

export function notFound(req: Request, res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
}