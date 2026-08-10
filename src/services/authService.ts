import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { RegisterRequest, LoginRequest, LoginResponse, PublicUser } from '../types/shared.js';

export async function registerUser(data: RegisterRequest): Promise<PublicUser> {
  const { name, email, password } = data;
  if (!name || !email || !password) {
    throw new AppError('Name, email, and password are all required', 400);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('An account with this email already exists', 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashedPassword });
  return { id: user.id, name: user.name, email: user.email };
}

export async function loginUser(data: LoginRequest): Promise<LoginResponse> {
  const { email, password } = data;
  const user = await User.findOne({ email });
  if (!user) throw new AppError('Invalid email or password', 401);

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) throw new AppError('Invalid email or password', 401);

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new AppError('Server misconfiguration', 500);

  const token = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: '7d' });
  return { message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email } };
}