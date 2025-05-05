// src/index.ts
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db"; // Import connectDB

// Import Routes
import authRoutes from "./routes/auth";
import therapistRoutes from "./routes/therapists"; // Import the new therapist routes

dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON bodies

// Mount Routes
app.use("/auth", authRoutes);
app.use("/therapists", therapistRoutes); // Mount therapist routes under /therapists

const { PORT } = process.env;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
