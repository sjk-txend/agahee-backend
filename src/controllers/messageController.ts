import type { Request, Response, NextFunction } from 'express';
import * as messageService from '../services/messageService.js';

export async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const senderId = req.user!.id;
    const { recipientId, text, replyTo } = req.body;
    const message = await messageService.createMessage({ senderId, recipientId, text, replyTo });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUserId = req.user!.id;
    const { otherUserId } = req.params;
    const { before, limit } = req.query;
    const result = await messageService.getConversationHistory({
      currentUserId,
      otherUserId,
      before: before as string | undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestingUserId = req.user!.id;
    const { id } = req.params;
    const message = await messageService.deleteMessage(id, requestingUserId);
    res.status(200).json(message);
  } catch (err) {
    next(err);
  }
}

export async function togglePin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { pinned } = req.body;
    const message = await messageService.togglePin(id, Boolean(pinned));
    res.status(200).json(message);
  } catch (err) {
    next(err);
  }
}

export async function addReaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { emoji } = req.body;
    const message = await messageService.addReaction(id, userId, emoji);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

export async function removeReaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const message = await messageService.removeReaction(id, userId);
    res.status(200).json(message);
  } catch (err) {
    next(err);
  }
}