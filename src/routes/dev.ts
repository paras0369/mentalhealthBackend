import { Request, Response, Router } from "express";
import { authenticateToken } from "../middleware/auth"; // Your existing auth middleware
import User from "../models/user.model"; // Your User model
import Transaction, { TransactionType } from "../models/transaction.model"; // Your Transaction model
import mongoose from "mongoose";

const router = Router();

// --- Add 100 Demo Coins ---
router.post(
  "/add-demo-coins",
  authenticateToken, // Ensure the user is logged in
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      // Should be caught by authenticateToken, but as a safeguard
      res.status(401).json({ message: "User not authenticated." });
      return;
    }

    const userId = req.user._id;
    const coinsToAdd = 100;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(userId).session(session);

      if (!user) {
        await session.abortTransaction();
        session.endSession();
        res.status(404).json({ message: "User not found." });
        return;
      }

      // Prevent therapists from adding demo coins to their client credit balance
      // Or allow it if that's desired for testing therapist-as-client scenarios.
      // For now, let's assume only clients use this for their creditBalance.
      if (user.role === "therapist") {
        // If you want therapists to also have a "creditBalance" for testing, remove this check.
        // Or, if therapists should add to their "earningBalance" for demo, modify accordingly.
        // This demo is for client creditBalance.
        await session.abortTransaction();
        session.endSession();
        res.status(403).json({
          message:
            "Therapists cannot add demo coins to client credit balance this way.",
        });
        return;
      }

      const balanceBefore = user.creditBalance;
      user.creditBalance += coinsToAdd;
      const balanceAfter = user.creditBalance;

      const demoTransaction = new Transaction({
        userId: user._id,
        type: TransactionType.CreditPurchase, // Simulate a purchase
        amount: coinsToAdd, // Positive amount for a purchase
        description: "Demo coins added for testing.",
        paymentGatewayRef: "DEMO_COINS",
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
      });

      await user.save({ session });
      await demoTransaction.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        message: `${coinsToAdd} demo coins added successfully.`,
        newCreditBalance: user.creditBalance,
        user: {
          // Return updated user subset if needed by frontend immediately
          id: user._id,
          email: user.email,
          role: user.role,
          creditBalance: user.creditBalance,
          // streamId: user.streamId // etc.
        },
      });
    } catch (error: any) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error adding demo coins:", error);
      res
        .status(500)
        .json({ message: "Failed to add demo coins.", details: error.message });
    }
  }
);

export default router;
