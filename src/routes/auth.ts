// src/routes/auth.ts
import { Request, Response, Router } from "express";
import { StreamChat } from "stream-chat";
import { hashSync, compareSync } from "bcrypt";
import User, { UserRole, IUser } from "../models/user.model"; // Import Mongoose model and Role enum
import dotenv from "dotenv";
import { sign } from "jsonwebtoken";

dotenv.config();

const router = Router();
const SALT_ROUNDS = 10;
const streamApiKey = process.env.STREAM_API_KEY;
const streamApiSecret = process.env.STREAM_API_SECRET;
const jwtSecret = process.env.JWT_SECRET;

if (!streamApiKey || !streamApiSecret) {
  throw new Error("STREAM_API_KEY and STREAM_API_SECRET must be defined");
}
if (!jwtSecret) {
  throw new Error("JWT_SECRET must be defined");
}

const client = StreamChat.getInstance(streamApiKey, streamApiSecret);

// Register endpoint
router.post("/register", async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters." });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists." });
    }

    // 1. Create user in Stream
    // Use a temporary or generated ID for Stream initially
    const streamId = Math.random().toString(36).substring(2, 9); // Or use a UUID library
    await client.upsertUser({
      id: streamId,
      email: email, // Keep email in Stream profile
      name: email, // Use email as name initially
      role: UserRole.Client, // Default role for registration
    });

    // 2. Create user in DB
    const hashed_password = hashSync(password, SALT_ROUNDS);
    const newUser = new User({
      email: email.toLowerCase(),
      hashed_password,
      streamId: streamId, // Store the Stream ID
      role: UserRole.Client,
      // Default balances/availability are set by schema
    });
    await newUser.save();

    // 3. Generate Tokens
    const streamToken = client.createToken(streamId);
    // Sign JWT with the MongoDB _id, NOT the streamId
    const jwt = sign({ userId: newUser._id }, jwtSecret);

    return res.status(201).json({
      token: streamToken, // Stream Token
      jwt, // Your API JWT
      user: {
        id: newUser._id, // Use MongoDB ID for your API references
        streamId: newUser.streamId, // Provide Stream ID for frontend client init
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error: any) {
    console.error("Registration Error:", error);
    // Cleanup Stream user if DB save failed? Maybe. Complex.
    if (error.code === 11000) {
      // Mongoose duplicate key error
      return res
        .status(400)
        .json({ message: "User creation failed: Duplicate key." });
    }
    return res
      .status(500)
      .json({ message: "Server error during registration." });
  }
});

// Login endpoint
router.post("/login", async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !compareSync(password, user.hashed_password)) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // User found and password matches
    const streamToken = client.createToken(user.streamId);
    // Sign JWT with the MongoDB _id
    const jwt = sign({ userId: user._id }, jwtSecret);

    return res.json({
      token: streamToken, // Stream Token
      jwt, // Your API JWT
      user: {
        id: user._id, // MongoDB ID
        streamId: user.streamId, // Stream ID
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Server error during login." });
  }
});

// Endpoint to create a therapist user (Consider making this an admin-only function later)
router.post(
  "/create-therapist",
  async (req: Request, res: Response): Promise<any> => {
    const { email, password, upiId } = req.body; // Add UPI ID if needed at creation

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });
    }

    try {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "User with this email already exists." });
      }

      const streamId = Math.random().toString(36).substring(2, 9); // Or use a UUID library
      await client.upsertUser({
        id: streamId,
        email: email,
        name: email,
        role: UserRole.Therapist, // Set Stream role correctly
      });

      const hashed_password = hashSync(password, SALT_ROUNDS);
      const newTherapist = new User({
        email: email.toLowerCase(),
        hashed_password,
        streamId: streamId,
        role: UserRole.Therapist, // Set DB role correctly
        isAvailable: false, // Therapists likely start as unavailable
        upiId: upiId || null,
      });
      await newTherapist.save();

      // Maybe don't log in the therapist automatically here? Just confirm creation.
      return res.status(201).json({
        message: "Therapist user created successfully.",
        user: {
          id: newTherapist._id,
          streamId: newTherapist.streamId,
          email: newTherapist.email,
          role: newTherapist.role,
        },
      });
    } catch (error: any) {
      console.error("Therapist Creation Error:", error);
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ message: "Therapist creation failed: Duplicate key." });
      }
      return res
        .status(500)
        .json({ message: "Server error during therapist creation." });
    }
  }
);

export default router;
