import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService.js';
import type { RegisterRequest, LoginRequest, LoginResponse, PublicUser, ApiError } from '../types/shared.js';

export async function register(
  req: Request<{}, {}, RegisterRequest>,
  res: Response<{ message: string; user: PublicUser } | ApiError>,
  next: NextFunction
): Promise<void> {
  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json({ message: 'Registration successful', user });
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: Request<{}, {}, LoginRequest>,
  res: Response<LoginResponse | ApiError>,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.loginUser(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}