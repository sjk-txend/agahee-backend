import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  isOnline: boolean;
  lastSeenAt: Date | null;
  resetPasswordToken: string | null;
  resetPasswordExpires: Date | null;
  blockedUsers: Types.ObjectId[];
  conversations: { withUser: Types.ObjectId; lastMessageAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
  toSafeObject(): Partial<IUser>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    isOnline: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    conversations: [
      { withUser: { type: Schema.Types.ObjectId, ref: 'User' }, lastMessageAt: { type: Date } },
    ],
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function (): Partial<IUser> {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

export default mongoose.model<IUser>('User', userSchema);