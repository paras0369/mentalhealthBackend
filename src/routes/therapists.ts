// src/routes/therapists.ts
import { Request, Response, Router } from "express";
import { authenticateToken } from "../middleware/auth";
import User, { UserRole, IUser } from "../models/user.model";

const router = Router();

// Endpoint 1: Update Therapist Availability
router.patch(
  "/me/availability",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    // Explicitly type return as Promise<void>
    const { isAvailable } = req.body;

    if (!req.user) {
      // No return needed here
      res
        .status(401)
        .json({ message: "Authentication failed, user not found on request." });
      return; // Use return to exit function early
    }
    const therapist = req.user as IUser;

    if (typeof isAvailable !== "boolean") {
      res.status(400).json({
        message: "Invalid input: isAvailable must be a boolean.",
      });
      return; // Use return to exit function early
    }

    if (therapist.role !== UserRole.Therapist) {
      res.status(403).json({
        message: "Forbidden: Only therapists can update availability.",
      });
      return; // Use return to exit function early
    }

    try {
      const userToUpdate = await User.findById(therapist._id);
      if (!userToUpdate) {
        res.status(404).json({ message: "Therapist not found in database." });
        return; // Use return to exit function early
      }

      userToUpdate.isAvailable = isAvailable;
      await userToUpdate.save();

      // No return needed before res.json
      res.json({
        message: "Availability updated successfully.",
        isAvailable: userToUpdate.isAvailable,
      });
    } catch (error) {
      console.error("Error updating availability:", error);
      // No return needed before res.status().json()
      res.status(500).json({ message: "Server error updating availability." });
    }
  }
);

// Endpoint 2: Get Available Therapists
router.get(
  "/available",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    // Explicitly type return as Promise<void>
    if (!req.user) {
      // No return needed here
      res
        .status(401)
        .json({ message: "Authentication failed, user not found on request." });
      return; // Use return to exit function early
    }

    try {
      const availableTherapists = await User.find({
        role: UserRole.Therapist,
        isAvailable: true,
      }).select("email streamId isAvailable _id");

      const formattedTherapists = availableTherapists.map((therapist) => ({
        id: therapist._id,
        name: therapist.email,
        streamId: therapist.streamId,
        isAvailable: therapist.isAvailable,
      }));

      // No return needed before res.json
      res.json(formattedTherapists);
    } catch (error) {
      console.error("Error fetching available therapists:", error);
      // No return needed before res.status().json()
      res
        .status(500)
        .json({ message: "Server error fetching available therapists." });
    }
  }
);

export default router;
