import mongoose, { Schema, Document, Types } from "mongoose";

export enum TransactionType {
  CreditPurchase = "credit_purchase", // Client buys credits
  CallDebit = "call_debit", // Client pays for call
  CallCredit = "call_credit", // Therapist earns from call
  WithdrawalRequest = "withdrawal_request", // Therapist requests payout (balance locked/reduced) - may not be needed if balance reduction happens on process
  WithdrawalProcessed = "withdrawal_processed", // Payout successful
  WithdrawalRejected = "withdrawal_rejected", // Payout failed
  // Add more types if needed (e.g., refund, bonus)
}

export interface ITransaction extends Document {
  userId: Types.ObjectId; // User involved (Client or Therapist)
  type: TransactionType;
  amount: number; // Positive for income/purchase, negative for spending/withdrawal
  description?: string;
  relatedCallId?: string; // Link to CallLog (callId field)
  relatedWithdrawalId?: Types.ObjectId; // Link to WithdrawalRequest
  paymentGatewayRef?: string; // Reference from payment provider
  balanceBefore: number; // User's balance before this transaction
  balanceAfter: number; // User's balance after this transaction
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    amount: { type: Number, required: true }, // Can be negative
    description: { type: String },
    relatedCallId: { type: String, index: true }, // Store Stream Call ID here
    relatedWithdrawalId: {
      type: Schema.Types.ObjectId,
      ref: "WithdrawalRequest",
      index: true,
    },
    paymentGatewayRef: { type: String, index: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

const Transaction = mongoose.model<ITransaction>(
  "Transaction",
  TransactionSchema
);
export default Transaction;
