// src/models/callLog.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export enum CallStatus {
  Initiated = "initiated",
  Active = "active",
  Completed = "completed",
  Failed = "failed",
  // Consider adding:
  // CompletedUnpaid = "completed_unpaid",
  // BillingFailed = "billing_failed",
}

export interface ICallLog extends Document {
  callId: string;
  clientId: Types.ObjectId;
  therapistId: Types.ObjectId;
  startTime?: Date;
  endTime?: Date;
  durationMinutes?: number;
  // This is the TypeScript interface, it should just be a number
  coinsPerMinuteRate: number; // <<<< CORRECTED HERE
  clientDebitedCoins?: number;
  therapistCreditedCoins?: number;
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
    // This is the Mongoose Schema definition, this is where type, default, min etc. go
    coinsPerMinuteRate: { type: Number, required: false, min: 1 }, // Make it not strictly required initially if it's set during billing
    clientDebitedCoins: { type: Number, min: 0 },
    therapistCreditedCoins: { type: Number, min: 0 },
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

// In the webhook, when you set it, ensure it's a number:
// callLog.coinsPerMinuteRate = therapistRate; // This should be fine as therapistRate is a number

const CallLog = mongoose.model<ICallLog>("CallLog", CallLogSchema);
export default CallLog;
