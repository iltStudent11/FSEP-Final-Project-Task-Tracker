import express, { type Request, type Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRouter from "./routes/auth";
import projectsRouter from "./routes/projects";
import tasksRouter from "./routes/tasks";
import dashboardRouter from "./routes/dashboard";
import { errorHandler } from "./middleware/errorHandler";

const DB_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

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

  return app;
}
