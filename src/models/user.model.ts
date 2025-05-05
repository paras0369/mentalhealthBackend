import mongoose, { Schema, Document } from "mongoose";

export enum UserRole {
  Therapist = "therapist",
  Client = "client",
}

// Interface representing a document in MongoDB.
export interface IUser extends Document {
  email: string;
  hashed_password: string;
  role: UserRole;
  streamId: string; // For Stream Chat/Video identification
  creditBalance: number; // For clients
  earningBalance: number; // For therapists
  isAvailable: boolean; // For therapists
  upiId?: string; // For therapists
  createdAt: Date;
  updatedAt: Date;
}

// Schema corresponding to the document interface.
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
      // Store the ID used in Stream
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    creditBalance: {
      // Relevant for clients
      type: Number,
      default: 0,
      min: 0,
    },
    earningBalance: {
      // Relevant for therapists
      type: Number,
      default: 0,
      min: 0,
    },
    isAvailable: {
      // Relevant for therapists
      type: Boolean,
      default: false,
    },
    upiId: {
      // Relevant for therapists
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt
  }
);

// Create and export the model.
const User = mongoose.model<IUser>("User", UserSchema);
export default User;
