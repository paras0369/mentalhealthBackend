// src/routes/user.ts (or a similar file, e.g., in auth.ts or a new users.ts)
import { Request, Response, Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { IUser } from "../models/user.model"; // Assuming User model is imported

const router = Router();

router.get(
  "/me",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    // req.user is populated by authenticateToken middleware
    const user = req.user as IUser;

    try {
      // The user object from authenticateToken should be up-to-date
      // as it's fetched from DB during token verification.
      // If you need to be absolutely sure or add more populated fields, you can re-fetch:
      // const freshUser = await User.findById(user._id);
      // if (!freshUser) {
      //   res.status(404).json({ message: "User not found" });
      //   return;
      // }

      res.status(200).json({
        id: user._id,
        email: user.email,
        role: user.role,
        streamId: user.streamId,
        creditBalance: user.creditBalance, // For clients
        earningBalance: user.earningBalance, // For therapists
        isAvailable: user.isAvailable, // For therapists
        upiId: user.upiId, // For therapists
        therapistRatePerMinute: user.therapistRatePerMinute, // For therapists
        // Add any other fields you want to return
      });
    } catch (error) {
      console.error("Error fetching /me data:", error);
      res.status(500).json({ message: "Server error fetching user data." });
    }
  }
);

export default router;
