import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import { registerSocketHandlers } from './index.js';
import User from '../models/User.js';

let httpServer: ReturnType<typeof createServer>;
let ioServer: SocketServer;
let port: number;

function waitForEvent<T = any>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitForMatchingEvent<T = any>(
  socket: ClientSocket,
  event: string,
  predicate: (data: T) => boolean,
  timeoutMs = 2000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for matching "${event}"`)), timeoutMs);
    const handler = (data: T) => {
      if (predicate(data)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(data);
      }
    };
    socket.on(event, handler);
  });
}

async function createTestUserWithToken(email: string) {
  const user = await User.create({ name: 'Test', email, password: 'hashed' });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!);
  return { user, token };
}

beforeAll(async () => {
  httpServer = createServer();
  ioServer = new SocketServer(httpServer);
  registerSocketHandlers(ioServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(() => {
      port = (httpServer.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(() => {
  ioServer.close();
  httpServer.close();
});

function connectClient(token: string): ClientSocket {
  return ioClient(`http://localhost:${port}`, { auth: { token } });
}

describe('Socket.io authentication', () => {
  it('rejects a connection with no token', async () => {
    const client = ioClient(`http://localhost:${port}`, { auth: {} });
    const error = await waitForEvent(client, 'connect_error');
    expect((error as Error).message).toContain('No token provided');
    client.close();
  });

  it('rejects a connection with an invalid token', async () => {
    const client = ioClient(`http://localhost:${port}`, { auth: { token: 'not-a-real-token' } });
    const error = await waitForEvent(client, 'connect_error');
    expect((error as Error).message).toContain('Invalid or expired token');
    client.close();
  });

  it('accepts a connection with a valid token', async () => {
    const { token } = await createTestUserWithToken('sock-auth1@test.com');
    const client = connectClient(token);
    await waitForEvent(client, 'connect');
    expect(client.connected).toBe(true);
    client.close();
  });
});

describe('Socket.io online status', () => {
  it('broadcasts userOnline when a user connects', async () => {
    const { token: watcherToken } = await createTestUserWithToken('sock-online-watcher@test.com');
    const { user: newUser, token: newUserToken } = await createTestUserWithToken('sock-online-new@test.com');

    const watcher = connectClient(watcherToken);
    await waitForEvent(watcher, 'connect');

    const onlinePromise = waitForMatchingEvent<{ userId: string }>(
      watcher,
      'userOnline',
      (data) => data.userId === newUser.id
    );
    const newClient = connectClient(newUserToken);
    await waitForEvent(newClient, 'connect');

    const event = await onlinePromise;
    expect(event.userId).toBe(newUser.id);

    watcher.close();
    newClient.close();
  });

  it('marks the user offline in the database after disconnecting', async () => {
    const { user, token } = await createTestUserWithToken('sock-offline@test.com');
    const client = connectClient(token);
    await waitForEvent(client, 'connect');

    client.close();
    await new Promise((resolve) => setTimeout(resolve, 200));

    const updated = await User.findById(user.id);
    expect(updated?.isOnline).toBe(false);
  });
});

describe('Socket.io typing indicator', () => {
  it('relays typing events to the other participant only', async () => {
    const { user: userA, token: tokenA } = await createTestUserWithToken('sock-typing-a@test.com');
    const { user: userB, token: tokenB } = await createTestUserWithToken('sock-typing-b@test.com');

    const clientA = connectClient(tokenA);
    const clientB = connectClient(tokenB);
    await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

    clientA.emit('joinConversation', userB.id);
    clientB.emit('joinConversation', userA.id);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const typingPromise = waitForEvent<{ userId: string }>(clientB, 'userTyping');
    clientA.emit('typing', { otherUserId: userB.id });

    const event = await typingPromise;
    expect(event.userId).toBe(userA.id);

    clientA.close();
    clientB.close();
  });
});

describe('Socket.io sendMessage', () => {
  it('creates a message and broadcasts it to both participants', async () => {
    const { user: userA, token: tokenA } = await createTestUserWithToken('sock-send-a@test.com');
    const { user: userB, token: tokenB } = await createTestUserWithToken('sock-send-b@test.com');

    const clientA = connectClient(tokenA);
    const clientB = connectClient(tokenB);
    await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

    clientA.emit('joinConversation', userB.id);
    clientB.emit('joinConversation', userA.id);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const messagePromise = waitForEvent<{ text: string }>(clientB, 'newMessage');
    clientA.emit('sendMessage', { recipientId: userB.id, text: 'hello via socket' });

    const message = await messagePromise;
    expect(message.text).toBe('hello via socket');

    clientA.close();
    clientB.close();
  });

  it('emits messageError when sending an empty message', async () => {
    const { token: tokenA } = await createTestUserWithToken('sock-send-empty-a@test.com');
    const { user: userB } = await createTestUserWithToken('sock-send-empty-b@test.com');

    const clientA = connectClient(tokenA);
    await waitForEvent(clientA, 'connect');

    const errorPromise = waitForEvent<{ error: string }>(clientA, 'messageError');
    clientA.emit('sendMessage', { recipientId: userB.id, text: '   ' });

    const event = await errorPromise;
    expect(event.error).toContain('cannot be empty');

    clientA.close();
  });
});