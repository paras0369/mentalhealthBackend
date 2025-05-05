// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import User, { IUser } from "../models/user.model"; // Import Mongoose User model and IUser interface
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const { JWT_SECRET } = process.env;

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: IUser; // Use the Mongoose IUser interface
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authorization header is missing",
      details: "Please include the JWT token in the Authorization header",
    });
  }

  const [bearer, token] = authHeader.split(" ");

  if (bearer !== "Bearer" || !token) {
    return res.status(401).json({
      message: "Invalid authorization format",
      details: "Authorization header must be in the format: Bearer <token>",
    });
  }

  if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not configured");
    return res
      .status(500)
      .json({ message: "Internal server configuration error." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }; // userId here is the MongoDB _id

    // Fetch user from MongoDB using the ID from the token
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        // Use 401 Unauthorized instead of 404
        message: "User not found",
        details:
          "The user associated with this token no longer exists or token is invalid",
      });
    }

    req.user = user; // Attach the full Mongoose user document
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        message: "Invalid or expired token",
        details: error.message,
      });
    }
    console.error("Authentication Error:", error);
    return res.status(500).json({
      message: "Authentication error",
      details: "An unexpected error occurred during authentication",
    });
  }
};
