import mongoose, { Schema, Document, Types } from "mongoose";

export enum CallStatus {
  Initiated = "initiated", // Call intent logged, not yet active in Stream
  Active = "active", // Both participants joined
  Completed = "completed", // Call finished normally
  Failed = "failed", // Call failed to connect or dropped unexpectedly
}

export interface ICallLog extends Document {
  callId: string; // Stream's Call ID
  clientId: Types.ObjectId;
  therapistId: Types.ObjectId;
  startTime?: Date;
  endTime?: Date;
  durationMinutes?: number;
  clientChargedAmount?: number;
  therapistEarnedAmount?: number;
  status: CallStatus;
  createdAt: Date;
  updatedAt: Date;
}

const CallLogSchema: Schema = new Schema(
  {
    callId: { type: String, required: true, unique: true, index: true },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    therapistId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startTime: { type: Date },
    endTime: { type: Date },
    durationMinutes: { type: Number, min: 0 },
    clientChargedAmount: { type: Number, min: 0 },
    therapistEarnedAmount: { type: Number, min: 0 },
    status: {
      type: String,
      enum: Object.values(CallStatus),
      default: CallStatus.Initiated,
    },
  },
  {
    timestamps: true,
  }
);

const CallLog = mongoose.model<ICallLog>("CallLog", CallLogSchema);
export default CallLog;
