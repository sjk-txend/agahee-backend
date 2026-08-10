import { describe, it, expect } from 'vitest';
import * as authService from './authService.js';
import User from '../models/User.js';

describe('authService.registerUser', () => {
  it('creates a user and returns a public shape with no password field', async () => {
    const result = await authService.registerUser({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result.name).toBe('Test User');
    expect(result.email).toBe('test@example.com');
    expect((result as any).password).toBeUndefined();
  });

  it('actually hashes the password before storing it', async () => {
    await authService.registerUser({
      name: 'Test User',
      email: 'test2@example.com',
      password: 'password123',
    });

    const stored = await User.findOne({ email: 'test2@example.com' });
    expect(stored?.password).not.toBe('password123');
  });

  it('rejects a duplicate email', async () => {
    await authService.registerUser({ name: 'A', email: 'dup@example.com', password: 'password123' });

    await expect(
      authService.registerUser({ name: 'B', email: 'dup@example.com', password: 'password456' })
    ).rejects.toThrow('An account with this email already exists');
  });
});