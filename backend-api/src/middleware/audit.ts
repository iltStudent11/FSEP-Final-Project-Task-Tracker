import type { Request, Response, NextFunction } from "express";
import { logAuditEvent } from "../utils/audit";

const TRACKED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function shouldSkip(path: string): boolean {
  return path === "/api/auth/login" || path === "/api/auth/register" || path === "/api/auth/logout";
}

function targetTypeForPath(path: string): string | undefined {
  if (path.startsWith("/api/projects")) return "project";
  if (path.startsWith("/api/tasks")) return "task";
  if (path.startsWith("/api/auth/users")) return "user";
  if (path.startsWith("/api/dashboard")) return "dashboard";
  if (path.startsWith("/api/audit")) return "audit";
  return undefined;
}

function resolveTargetId(params: Request["params"]): string | undefined {
  const values = Object.values(params);

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    const targetId = Array.isArray(value) ? value[0] : value;

    if (typeof targetId === "string" && targetId) {
      return targetId;
    }
  }

  return undefined;
}

export function trackAuditActions(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  const path = req.path;

  if (!TRACKED_METHODS.has(method) || shouldSkip(path)) {
    next();
    return;
  }

  res.on("finish", () => {
    if (res.statusCode >= 400 || !req.user) return;

    const targetType = targetTypeForPath(path);
    const targetId = resolveTargetId(req.params);

    void logAuditEvent({
      req,
      actor: req.user,
      eventType: "action",
      action: `${method} ${path}`,
      ...(targetType ? { targetType } : {}),
      ...(targetId ? { targetId } : {}),
      details: {
        query: req.query,
        body: req.body,
        statusCode: res.statusCode,
      },
    });
  });

  next();
}
