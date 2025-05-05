import mongoose, { Schema, Document, Types } from "mongoose";

export enum WithdrawalStatus {
  Pending = "pending",
  Processed = "processed",
  Rejected = "rejected",
}

export interface IWithdrawalRequest extends Document {
  therapistId: Types.ObjectId;
  amount: number;
  upiIdAtRequest: string; // Store the UPI ID used for this specific request
  status: WithdrawalStatus;
  requestTimestamp: Date;
  processedTimestamp?: Date;
  rejectionReason?: string;
  adminNotes?: string; // Notes from the admin processing the request
  transactionId?: Types.ObjectId; // Link to the corresponding withdrawal transaction
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalRequestSchema: Schema = new Schema(
  {
    therapistId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 }, // Example minimum withdrawal
    upiIdAtRequest: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(WithdrawalStatus),
      default: WithdrawalStatus.Pending,
    },
    requestTimestamp: { type: Date, default: Date.now },
    processedTimestamp: { type: Date },
    rejectionReason: { type: String },
    adminNotes: { type: String },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
  },
  {
    timestamps: true,
  }
);

const WithdrawalRequest = mongoose.model<IWithdrawalRequest>(
  "WithdrawalRequest",
  WithdrawalRequestSchema
);
export default WithdrawalRequest;
