import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      throw new AppError('No token provided', 401);
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new AppError('Server misconfiguration', 500);
    }

    const decoded = jwt.verify(token, jwtSecret);
    if (typeof decoded === 'string') {
      throw new AppError('Invalid token', 401);
    }

    req.user = decoded as Express.Request['user'];
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}