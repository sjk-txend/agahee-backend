import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import User from '../models/User.js';

async function createTestUserWithToken(email: string) {
  const user = await User.create({ name: 'Test', email, password: 'hashed' });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!);
  return { user, token };
}

describe('GET /api/health', () => {
  it('responds with ok status, no auth needed', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/messages (full HTTP flow)', () => {
  it('rejects a request with no auth token', async () => {
    const res = await request(app).post('/api/messages').send({ recipientId: 'x', text: 'hi' });
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid token', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ recipientId: 'x', text: 'hi' });
    expect(res.status).toBe(401);
  });

  it('sends a message successfully through the real route, middleware, and controller', async () => {
    const { token: senderToken } = await createTestUserWithToken('e2e-sender@test.com');
    const { user: recipient } = await createTestUserWithToken('e2e-recipient@test.com');

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId: recipient.id, text: 'hello via real HTTP' });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe('hello via real HTTP');
  });

  it('rejects an empty message through the real HTTP flow', async () => {
    const { token: senderToken } = await createTestUserWithToken('e2e-sender2@test.com');
    const { user: recipient } = await createTestUserWithToken('e2e-recipient2@test.com');

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId: recipient.id, text: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot be empty');
  });
});

describe('GET /api/messages/conversations/:otherUserId/messages (full HTTP flow)', () => {
  it('returns message history through the real route', async () => {
    const { token: senderToken } = await createTestUserWithToken('e2e-hist-sender@test.com');
    const { user: recipient } = await createTestUserWithToken('e2e-hist-recipient@test.com');

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId: recipient.id, text: 'first message' });

    const res = await request(app)
      .get(`/api/messages/conversations/${recipient.id}/messages`)
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].text).toBe('first message');
  });
});

describe('unmatched route (full HTTP flow)', () => {
  it('returns 404 with a consistent error shape', async () => {
    const res = await request(app).get('/api/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});