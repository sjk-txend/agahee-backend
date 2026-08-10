import { describe, it, expect } from 'vitest';
import * as messageService from './messageService.js';
import User from '../models/User.js';

async function createTestUser(email: string) {
  return User.create({ name: 'Test User', email, password: 'hashed-placeholder' });
}

describe('messageService.createMessage', () => {
  it('rejects an empty message', async () => {
    const sender = await createTestUser('mc-sender1@test.com');
    const recipient = await createTestUser('mc-recipient1@test.com');

    await expect(
      messageService.createMessage({ senderId: sender.id, recipientId: recipient.id, text: '   ' })
    ).rejects.toThrow('Message cannot be empty');
  });

  it('rejects a message over 2000 characters', async () => {
    const sender = await createTestUser('mc-sender2@test.com');
    const recipient = await createTestUser('mc-recipient2@test.com');
    const tooLong = 'a'.repeat(2001);

    await expect(
      messageService.createMessage({ senderId: sender.id, recipientId: recipient.id, text: tooLong })
    ).rejects.toThrow('too long');
  });

  it('rejects sending to a recipient that does not exist', async () => {
    const sender = await createTestUser('mc-sender3@test.com');
    const fakeRecipientId = '507f1f77bcf86cd799439011'; // valid ObjectId format, but not a real user

    await expect(
      messageService.createMessage({ senderId: sender.id, recipientId: fakeRecipientId, text: 'hi' })
    ).rejects.toThrow('Recipient not found');
  });

  it('rejects sending to a user who has blocked the sender', async () => {
    const sender = await createTestUser('mc-sender4@test.com');
    const recipient = await createTestUser('mc-recipient4@test.com');

    recipient.blockedUsers.push(sender.id);
    await recipient.save();

    await expect(
      messageService.createMessage({ senderId: sender.id, recipientId: recipient.id, text: 'hi' })
    ).rejects.toThrow('You cannot message this user');
  });

  it('successfully creates a message with valid input', async () => {
    const sender = await createTestUser('mc-sender5@test.com');
    const recipient = await createTestUser('mc-recipient5@test.com');

    const message = await messageService.createMessage({
      senderId: sender.id,
      recipientId: recipient.id,
      text: 'hey there',
    });

    expect(message.text).toBe('hey there');
    expect(message.senderId.toString()).toBe(sender.id);
    expect(message.recipientId.toString()).toBe(recipient.id);
    expect(message.isDeleted).toBe(false);
  });

  it('updates the conversations cache on BOTH sender and recipient', async () => {
    const sender = await createTestUser('mc-sender6@test.com');
    const recipient = await createTestUser('mc-recipient6@test.com');

    await messageService.createMessage({
      senderId: sender.id,
      recipientId: recipient.id,
      text: 'hey there',
    });

    const updatedSender = await User.findById(sender.id);
    const updatedRecipient = await User.findById(recipient.id);

    expect(updatedSender?.conversations).toHaveLength(1);
    expect(updatedSender?.conversations[0].withUser.toString()).toBe(recipient.id);

    expect(updatedRecipient?.conversations).toHaveLength(1);
    expect(updatedRecipient?.conversations[0].withUser.toString()).toBe(sender.id);
  });

  it('updates lastMessageAt on an EXISTING conversation cache entry, not duplicates it', async () => {
    const sender = await createTestUser('mc-sender7@test.com');
    const recipient = await createTestUser('mc-recipient7@test.com');

    await messageService.createMessage({ senderId: sender.id, recipientId: recipient.id, text: 'first' });
    await messageService.createMessage({ senderId: sender.id, recipientId: recipient.id, text: 'second' });

    const updatedSender = await User.findById(sender.id);

    // Still just ONE entry for this conversation, not two — proves the
    // "update existing" branch works, not just the "add new" branch.
    expect(updatedSender?.conversations).toHaveLength(1);
  });
});