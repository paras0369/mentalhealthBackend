import { Request, Response, Router } from "express";
import { authenticateToken } from "../middleware/auth"; // Middleware to ensure user is logged in
import User, { UserRole, IUser } from "../models/user.model"; // User model

const router = Router();

// --- Get Logged-in Therapist's Own Data ---
router.get(
  "/me",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    // req.user is populated by authenticateToken middleware and is guaranteed to exist if middleware passed
    const user = req.user as IUser; // Type assertion is safe here after middleware

    // Ensure the user making the request is actually a therapist
    if (user.role !== UserRole.Therapist) {
      res.status(403).json({
        message: "Forbidden: Only therapists can access this endpoint.",
      });
      return; // Exit function
    }

    try {
      // Respond with relevant therapist data
      // Select the fields you want to send back - avoid sending sensitive data like hashed_password
      res.status(200).json({
        // Use 200 OK status
        id: user._id,
        email: user.email,
        streamId: user.streamId,
        role: user.role,
        isAvailable: user.isAvailable,
        earningBalance: user.earningBalance,
        upiId: user.upiId,
        creditBalance: user.creditBalance,
        // Add any other relevant non-sensitive fields from the IUser model here if needed
      });
    } catch (error) {
      // Catch any unexpected errors during data processing/sending
      console.error("Error fetching therapist /me data:", error);
      res
        .status(500)
        .json({ message: "Server error fetching therapist data." });
    }
  }
);

// --- Update Therapist Availability ---
router.patch(
  "/me/availability",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    const { isAvailable } = req.body;

    // Middleware guarantees req.user exists here
    const therapist = req.user as IUser;

    // 1. Input Validation
    if (typeof isAvailable !== "boolean") {
      res
        .status(400)
        .json({ message: "Invalid input: isAvailable must be a boolean." });
      return; // Exit
    }

    // 2. Authorization Validation
    if (therapist.role !== UserRole.Therapist) {
      res.status(403).json({
        message: "Forbidden: Only therapists can update availability.",
      });
      return; // Exit
    }

    try {
      // 3. Find the user document again by ID for update (safer than updating req.user directly)
      const userToUpdate = await User.findById(therapist._id);

      // Check if user still exists in DB (edge case)
      if (!userToUpdate) {
        res
          .status(404)
          .json({ message: "Therapist not found in database during update." });
        return; // Exit
      }
      // Verify again it's still a therapist (extra check)
      if (userToUpdate.role !== UserRole.Therapist) {
        res
          .status(403)
          .json({ message: "Forbidden: User is no longer a therapist." });
        return; // Exit
      }

      // 4. Perform the update and save
      userToUpdate.isAvailable = isAvailable;
      await userToUpdate.save(); // Save the changes to the database

      // 5. Respond with success and the updated status
      res.status(200).json({
        // Use 200 OK status
        message: "Availability updated successfully.",
        isAvailable: userToUpdate.isAvailable, // Return the confirmed saved value
      });
    } catch (error) {
      console.error("Error updating availability:", error);
      res.status(500).json({ message: "Server error updating availability." });
    }
  }
);

// --- Get Available Therapists (For Client View) ---
router.get(
  "/available",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    // Check if req.user exists (guaranteed by middleware but good practice)
    if (!req.user) {
      res
        .status(401)
        .json({ message: "Authentication failed, user not found on request." });
      return; // Exit
    }
    // Although any authenticated user can call this, you might restrict to clients if needed
    // if (req.user.role !== UserRole.Client) {
    //    res.status(403).json({ message: 'Forbidden: Only clients can view available therapists.' });
    //    return;
    // }

    try {
      // 1. Query the database for available therapists
      const availableTherapists = await User.find({
        role: UserRole.Therapist, // Must be a therapist
        isAvailable: true, // Must be available
      }).select("email streamId isAvailable _id name"); // Select only necessary public fields (add 'name' if you have it)

      // 2. Format the response data (Map DB fields to desired output)
      const formattedTherapists = availableTherapists.map((therapist) => ({
        id: therapist._id, // MongoDB ID
        name: therapist.email, // Use name field if exists, otherwise email
        streamId: therapist.streamId, // Stream ID
        isAvailable: therapist.isAvailable, // Should always be true here based on query
        // Add other fields like specialties, photoUrl if you add them to the select() and schema
      }));

      // 3. Send the list
      res.status(200).json(formattedTherapists); // Use 200 OK
    } catch (error) {
      console.error("Error fetching available therapists:", error);
      res
        .status(500)
        .json({ message: "Server error fetching available therapists." });
    }
  }
);

export default router;
