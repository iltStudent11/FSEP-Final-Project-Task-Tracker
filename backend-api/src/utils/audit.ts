import type { Request } from "express";
import AuditLog, { type AuditEventType } from "../models/AuditLog";
import type { IUser } from "../models/User";

type AuditDetails = Record<string, unknown>;

type LogAuditInput = {
  req?: Request;
  actor: IUser;
  eventType: AuditEventType;
  action: string;
  route?: string;
  method?: string;
  targetType?: string;
  targetId?: string;
  details?: AuditDetails;
};

function sanitizeDetails(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeDetails(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sensitiveKeys = new Set(["password", "token", "authorization"]);
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, current] of Object.entries(input)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = sanitizeDetails(current);
  }

  return output;
}

function resolveIp(req?: Request): string | undefined {
  if (!req) return undefined;

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim();
  }

  return req.ip;
}

export async function logAuditEvent({
  req,
  actor,
  eventType,
  action,
  route,
  method,
  targetType,
  targetId,
  details,
}: LogAuditInput): Promise<void> {
  await AuditLog.create({
    actor: actor._id.toString(),
    actorEmail: actor.email,
    actorRole: actor.role,
    eventType,
    action,
    route: route ?? req?.path,
    method: method ?? req?.method,
    targetType,
    targetId,
    details: details ? sanitizeDetails(details) : undefined,
    ip: resolveIp(req),
    userAgent: req?.headers["user-agent"],
  });
}
