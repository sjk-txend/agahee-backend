import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMessageReaction {
  userId: Types.ObjectId;
  emoji: string;
}

export interface IMessage extends Document {
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  text: string;
  isDeleted: boolean;
  readBy: Types.ObjectId[];
  reactions: IMessageReaction[];
  replyTo: Types.ObjectId | null;
  forwardedFrom: Types.ObjectId | null;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  isVisibleTo(userId: string): boolean;
}

const messageSchema = new Schema<IMessage>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    isDeleted: { type: Boolean, default: false },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reactions: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        emoji: String,
      },
    ],
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    forwardedFrom: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });

messageSchema.methods.isVisibleTo = function (userId: string): boolean {
  return !this.isDeleted;
};

export default mongoose.model<IMessage>('Message', messageSchema);