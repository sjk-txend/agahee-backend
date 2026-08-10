import Message from '../models/Message.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { Types } from 'mongoose';

const PIN_LIMIT_PER_CONVERSATION = 5;

export async function createMessage(params: {
  senderId: string;
  recipientId: string;
  text: string;
  replyTo?: string | null;
}) {
  const { senderId, recipientId, text, replyTo = null } = params;

  const trimmed = text?.trim();
  if (!trimmed) throw new AppError('Message cannot be empty', 400);
  if (trimmed.length > 2000) throw new AppError('Message is too long (max 2000 characters)', 400);

  const recipient = await User.findById(recipientId);
  if (!recipient) throw new AppError('Recipient not found', 404);
  if (recipient.blockedUsers.some((id) => id.toString() === senderId)) {
    throw new AppError('You cannot message this user', 403);
  }

  const message = await Message.create({ senderId, recipientId, text: trimmed, replyTo });

  await updateConversationCache(senderId, recipientId, message.createdAt);
  await updateConversationCache(recipientId, senderId, message.createdAt);

  return message;
}

async function updateConversationCache(userId: string, otherUserId: string, when: Date) {
  const user = await User.findById(userId);
  if (!user) return;

  const existing = user.conversations.find((c) => c.withUser.toString() === otherUserId);
  if (existing) {
    existing.lastMessageAt = when;
  } else {
    user.conversations.push({ withUser: otherUserId as unknown as Types.ObjectId, lastMessageAt: when });
  }
  await user.save();
}

export async function getConversationHistory(params: {
  currentUserId: string;
  otherUserId: string;
  before?: string;
  limit?: number;
}) {
  const { currentUserId, otherUserId, before, limit = 30 } = params;

  const query: Record<string, unknown> = {
    isDeleted: { $ne: true },
    $or: [
      { senderId: currentUserId, recipientId: otherUserId },
      { senderId: otherUserId, recipientId: currentUserId },
    ],
  };
  if (before) query.createdAt = { $lt: new Date(before) };

  const messages = await Message.find(query).sort({ createdAt: -1 }).limit(limit + 1);
  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;

  return { messages: page.reverse(), hasMore };
}

export async function deleteMessage(messageId: string, requestingUserId: string) {
  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', 404);
  if (message.senderId.toString() !== requestingUserId) {
    throw new AppError('Only the sender can delete this message', 403);
  }
  message.isDeleted = true;
  await message.save();
  return message;
}

export async function togglePin(messageId: string, pinned: boolean) {
  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', 404);

  if (pinned) {
    const pinnedCount = await Message.countDocuments({
      isPinned: true,
      isDeleted: { $ne: true },
      $or: [
        { senderId: message.senderId, recipientId: message.recipientId },
        { senderId: message.recipientId, recipientId: message.senderId },
      ],
    });
    if (pinnedCount >= PIN_LIMIT_PER_CONVERSATION) {
      throw new AppError(`Cannot pin more than ${PIN_LIMIT_PER_CONVERSATION} messages in a conversation`, 400);
    }
  }

  message.isPinned = pinned;
  await message.save();
  return message;
}

export async function addReaction(messageId: string, userId: string, emoji: string) {
  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', 404);

  message.reactions = message.reactions.filter((r) => r.userId.toString() !== userId);
  message.reactions.push({ userId: userId as unknown as Types.ObjectId, emoji });
  await message.save();
  return message;
}

export async function removeReaction(messageId: string, userId: string) {
  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', 404);

  message.reactions = message.reactions.filter((r) => r.userId.toString() !== userId);
  await message.save();
  return message;
}