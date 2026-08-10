import express from 'express';
import * as messageController from '../controllers/messageController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.post('/', messageController.sendMessage);
router.get('/conversations/:otherUserId/messages', messageController.getHistory);
router.delete('/:id', messageController.deleteMessage);
router.patch('/:id/pin', messageController.togglePin);
router.post('/:id/reactions', messageController.addReaction);
router.delete('/:id/reactions', messageController.removeReaction);

export default router;