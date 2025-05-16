// src/models/user.model.ts
import mongoose, { Schema, Document } from "mongoose";

export enum UserRole {
  Therapist = "therapist",
  Client = "client",
}

export interface IUser extends Document {
  email: string;
  hashed_password: string;
  role: UserRole;
  streamId: string;
  creditBalance: number; // COINS for clients
  earningBalance: number; // COINS for therapists
  isAvailable: boolean;
  upiId?: string;
  therapistRatePerMinute?: number; // <<<< TypeScript interface: just number
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    hashed_password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      default: UserRole.Client,
    },
    streamId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    creditBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    earningBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
    upiId: {
      type: String,
      trim: true,
      default: null,
    },
    // Mongoose schema definition for the rate
    therapistRatePerMinute: { type: Number, min: 1, default: 5 }, // <<<< Mongoose schema
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>("User", UserSchema);
export default User;
