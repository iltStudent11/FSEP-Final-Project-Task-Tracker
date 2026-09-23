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

function sanitizeDetails(value: AuditDetails): AuditDetails;
function sanitizeDetails(value: unknown): unknown;
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

function resolveUserAgent(req?: Request): string | undefined {
  const userAgent = req?.headers["user-agent"];
  return Array.isArray(userAgent) ? userAgent[0] : userAgent;
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
  const routeValue = route ?? req?.path;
  const methodValue = method ?? req?.method;
  const ipValue = resolveIp(req);
  const userAgentValue = resolveUserAgent(req);

  const auditLog: {
    actor: string;
    actorEmail: string;
    actorRole: IUser["role"];
    eventType: AuditEventType;
    action: string;
    route?: string;
    method?: string;
    targetType?: string;
    targetId?: string;
    details?: AuditDetails;
    ip?: string;
    userAgent?: string;
  } = {
    actor: actor._id.toString(),
    actorEmail: actor.email,
    actorRole: actor.role,
    eventType,
    action,
  };

  if (routeValue) auditLog.route = routeValue;
  if (methodValue) auditLog.method = methodValue;
  if (targetType) auditLog.targetType = targetType;
  if (targetId) auditLog.targetId = targetId;
  if (details) auditLog.details = sanitizeDetails(details);
  if (ipValue) auditLog.ip = ipValue;
  if (userAgentValue) auditLog.userAgent = userAgentValue;

  await AuditLog.create(auditLog);
}
