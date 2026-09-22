import express, { type Request, type Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";
import authRouter from "./routes/auth";
import projectsRouter from "./routes/projects";
import tasksRouter from "./routes/tasks";
import dashboardRouter from "./routes/dashboard";
import adminRouter from "./routes/admin";
import { errorHandler } from "./middleware/errorHandler";
import { swaggerSpec } from "./swagger";

const DB_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export function createApp() {
  const app = express();

  app.use(cors());
  // Default 100kb limit is too small for a full-database backup/restore payload.
  app.use(express.json({ limit: "20mb" }));

  app.get("/api/docs.json", (_req: Request, res: Response) => {
    res.status(200).json(swaggerSpec);
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "FSEP Task Tracker API Docs",
    }),
  );

  /**
   * @openapi
   * /health:
   *   get:
   *     tags: [Health]
   *     summary: Server + database connectivity check
   *     security: []
   *     responses:
   *       200:
   *         description: API and database are both reachable
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, enum: [ok] }
   *                 db: { type: string, enum: [connected] }
   *       503:
   *         description: Database is not connected
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, enum: [error] }
   *                 db: { type: string, enum: [connecting, disconnecting, disconnected] }
   */
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
  app.use("/api/admin", adminRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: "Not found" });
  });

  app.use(errorHandler);

  return app;
}
