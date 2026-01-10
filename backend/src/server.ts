import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { devicesRouter } from "./routes/devices.js";
import { presetsRouter } from "./routes/presets.js";
import { showsRouter } from "./routes/shows.js";
import { cuesRouter } from "./routes/cues.js";
import { cueListsRouter } from "./routes/cueLists.js";
import { executionRouter } from "./routes/execution.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { connectionManager } from "./services/connectionManager.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Vite default port
    credentials: true,
  })
);
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/devices", devicesRouter);
app.use("/api/presets", presetsRouter);
app.use("/api/shows", showsRouter);
app.use("/api/cues", cuesRouter);
app.use("/api/cue-lists", cueListsRouter);
app.use("/api/execution", executionRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler (must be last)
app.use(errorHandler);

// Initialize connection manager and start server
connectionManager.initialize().catch((error) => {
  console.error("Error initializing connection manager:", error);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing HTTP server");
  connectionManager.stopMonitoring();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT signal received: closing HTTP server");
  connectionManager.stopMonitoring();
  process.exit(0);
});
