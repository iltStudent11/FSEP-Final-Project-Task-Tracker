import { Router, type Request, type Response } from "express";
import { body, query } from "express-validator";
import AuditLog from "../models/AuditLog";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { logAuditEvent } from "../utils/audit";

const router = Router();

router.post(
  "/events",
  authenticate,
  validate([
    body("tab").trim().notEmpty().withMessage("Tab is required"),
    body("path").optional().trim().notEmpty().withMessage("Path cannot be empty"),
  ]),
  async (req: Request, res: Response) => {
    const { tab, path } = req.body as { tab: string; path?: string };

    if (!req.user) {
      res.status(401).json({ message: "Missing or malformed authorization header" });
      return;
    }

    await logAuditEvent({
      req,
      actor: req.user,
      eventType: "navigation",
      action: `Visited tab: ${tab}`,
      route: path ?? req.path,
      details: {
        tab,
        path,
      },
    });

    res.status(201).json({ ok: true });
  },
);

router.get(
  "/",
  authenticate,
  authorizeRoles("admin"),
  validate([
    query("user").optional().isMongoId().withMessage("Invalid user id"),
    query("eventType")
      .optional()
      .isIn(["auth", "navigation", "action"])
      .withMessage("Invalid event type"),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be >= 1"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be 1-100"),
  ]),
  async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const user = typeof req.query.user === "string" ? req.query.user : undefined;
    const eventType =
      typeof req.query.eventType === "string"
        ? (req.query.eventType as "auth" | "navigation" | "action")
        : undefined;

    const filter: Record<string, unknown> = {};
    if (user) filter.actor = user;
    if (eventType) filter.eventType = eventType;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    res.status(200).json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  },
);

export default router;
