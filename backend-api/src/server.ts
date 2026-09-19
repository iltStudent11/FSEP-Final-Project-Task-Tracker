import dotenv from "dotenv";

dotenv.config();

import express, { type Request, type Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import { connectDB } from "./config/db";
import authRouter from "./routes/auth";
import projectsRouter from "./routes/projects";
import tasksRouter from "./routes/tasks";
import dashboardRouter from "./routes/dashboard";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const DB_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

app.get("/api/health", (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbConnected = dbState === 1;

  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? "ok" : "error",
    db: DB_STATES[dbState] ?? "unknown",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/dashboard", dashboardRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);

async function main(): Promise<void> {
  await connectDB();

  // No callback is passed to app.listen(): Express binds a listen callback
  // to both the "listening" and "error" events, so it fires on bind failure
  // too. Attaching our own listeners below avoids that false-success trap.
  const server = app.listen(PORT);

  server.on("listening", () => {
    console.log(`Server listening on port ${PORT}`);
  });

  server.on("error", (err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
