import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import * as messageService from '../services/messageService.js';
import { getConversationRoomId } from './roomId.js';

const onlineUsers = new Map<string, Set<string>>();

function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('No token provided'));

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return next(new Error('Server misconfiguration'));

    const decoded = jwt.verify(token, jwtSecret);
    if (typeof decoded === 'string' || !decoded.id) return next(new Error('Invalid token'));

    socket.data.userId = decoded.id as string;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}

export function registerSocketHandlers(io: Server): void {
  io.use(authenticateSocket);

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    handleConnect(io, socket, userId);

    socket.on('joinConversation', (otherUserId: string) => {
      socket.join(getConversationRoomId(userId, otherUserId));
    });

    socket.on('typing', ({ otherUserId }: { otherUserId: string }) => {
      socket.to(getConversationRoomId(userId, otherUserId)).emit('userTyping', { userId });
    });

    socket.on('stopTyping', ({ otherUserId }: { otherUserId: string }) => {
      socket.to(getConversationRoomId(userId, otherUserId)).emit('userStoppedTyping', { userId });
    });

    socket.on(
      'sendMessage',
      async (payload: { recipientId: string; text: string; replyTo?: string | null }) => {
        try {
          const message = await messageService.createMessage({
            senderId: userId,
            recipientId: payload.recipientId,
            text: payload.text,
            replyTo: payload.replyTo,
          });
          io.to(getConversationRoomId(userId, payload.recipientId)).emit('newMessage', message);
        } catch (err) {
          socket.emit('messageError', { error: (err as Error).message });
        }
      }
    );

    socket.on('disconnect', () => handleDisconnect(io, socket, userId));
  });
}

async function handleConnect(io: Server, socket: Socket, userId: string) {
  const sockets = onlineUsers.get(userId) ?? new Set<string>();
  const wasAlreadyOnline = sockets.size > 0;
  sockets.add(socket.id);
  onlineUsers.set(userId, sockets);

  if (!wasAlreadyOnline) {
    await User.findByIdAndUpdate(userId, { isOnline: true });
    io.emit('userOnline', { userId });
  }
}

async function handleDisconnect(io: Server, socket: Socket, userId: string) {
  const sockets = onlineUsers.get(userId);
  sockets?.delete(socket.id);

  if (!sockets || sockets.size === 0) {
    onlineUsers.delete(userId);
    const lastSeenAt = new Date();
    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeenAt });
    io.emit('userOffline', { userId, lastSeenAt });
  }
}