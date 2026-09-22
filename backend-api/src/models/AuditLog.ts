import { Schema, model, type Document, type Model } from "mongoose";
import type { UserRole } from "./User";

export type AuditEventType = "auth" | "navigation" | "action";

export interface IAuditLog extends Document {
  actor: string;
  actorEmail: string;
  actorRole: UserRole;
  eventType: AuditEventType;
  action: string;
  route?: string;
  method?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

export type AuditLogModel = Model<IAuditLog>;

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      type: String,
      required: true,
      index: true,
    },
    actorEmail: {
      type: String,
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      enum: ["admin", "member", "lead"],
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ["auth", "navigation", "action"],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    route: {
      type: String,
      trim: true,
    },
    method: {
      type: String,
      trim: true,
    },
    targetType: {
      type: String,
      trim: true,
    },
    targetId: {
      type: String,
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    ip: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  },
);

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ eventType: 1, createdAt: -1 });

export default model<IAuditLog>("AuditLog", auditLogSchema);
