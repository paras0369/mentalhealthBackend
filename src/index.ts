import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db";

import authRoutes from "./routes/auth";
import therapistRoutes from "./routes/therapists";
import webhookRoutes from "./routes/webhooks";

dotenv.config();
connectDB();
const app = express();

app.use(cors());

// Webhook route with raw body parsing
app.use(
  "/webhooks/stream",
  express.raw({ type: "application/json" }),
  webhookRoutes
);

// Other middleware
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/therapists", therapistRoutes);

// Debug unhandled routes
app.use((req, res) => {
  console.log(`[DEBUG] Unhandled request: ${req.method} ${req.originalUrl}`);
  res.status(404).send("Route not found");
});

const { PORT } = process.env;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
