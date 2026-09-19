import { Schema, model, type Document, type Types } from "mongoose";

export type PolicyType = "auto" | "home" | "life";
export type PolicyStatus = "active" | "expired" | "cancelled";

export interface IPolicy extends Document {
  policyNumber: string;
  holderName: string;
  type: PolicyType;
  premium: number;
  status: PolicyStatus;
  effectiveDate: Date;
  expirationDate: Date;
  owner: Types.ObjectId;
  createdAt: Date;
}

const policySchema = new Schema<IPolicy>({
  policyNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  holderName: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["auto", "home", "life"],
    required: true,
  },
  premium: {
    type: Number,
    min: 0,
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "expired", "cancelled"],
    required: true,
  },
  effectiveDate: {
    type: Date,
    required: true,
  },
  expirationDate: {
    type: Date,
    required: true,
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default model<IPolicy>("Policy", policySchema);
