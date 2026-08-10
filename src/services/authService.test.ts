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

describe('authService.loginUser', () => {
  it('logs in successfully with correct credentials and returns a token', async () => {
    await authService.registerUser({ name: 'Login Test', email: 'login@test.com', password: 'correctpass' });

    const result = await authService.loginUser({ email: 'login@test.com', password: 'correctpass' });

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.user.email).toBe('login@test.com');
  });

  it('rejects a correct email with the wrong password', async () => {
    await authService.registerUser({ name: 'Login Test', email: 'login2@test.com', password: 'correctpass' });

    await expect(
      authService.loginUser({ email: 'login2@test.com', password: 'wrongpass' })
    ).rejects.toThrow('Invalid email or password');
  });

  it('rejects an email that was never registered', async () => {
    await expect(
      authService.loginUser({ email: 'nobody@test.com', password: 'anything' })
    ).rejects.toThrow('Invalid email or password');
  });

  it('uses the SAME error message for wrong password and nonexistent email', async () => {
    // This confirms the security property directly, not just that both fail —
    // if someone later "improves" one error message and forgets the other,
    // this test catches the mismatch immediately.
    await authService.registerUser({ name: 'X', email: 'exists@test.com', password: 'correctpass' });

    let errorForWrongPassword = '';
    let errorForNoEmail = '';

    try {
      await authService.loginUser({ email: 'exists@test.com', password: 'wrong' });
    } catch (err) {
      errorForWrongPassword = (err as Error).message;
    }

    try {
      await authService.loginUser({ email: 'doesnotexist@test.com', password: 'wrong' });
    } catch (err) {
      errorForNoEmail = (err as Error).message;
    }

    expect(errorForWrongPassword).toBe(errorForNoEmail);
  });
});