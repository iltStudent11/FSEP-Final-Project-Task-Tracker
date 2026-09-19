import { Schema, model, type Document, type Types } from "mongoose";

export type ProjectCategory = "web" | "mobile" | "data";
export type ProjectStatus = "active" | "on-hold" | "completed";

export interface IProject extends Document {
  projectCode: string;
  name: string;
  category: ProjectCategory;
  budgetHours: number;
  status: ProjectStatus;
  startDate: Date;
  targetDate: Date;
  owner: Types.ObjectId;
  createdAt: Date;
}

const projectSchema = new Schema<IProject>({
  projectCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ["web", "mobile", "data"],
    required: true,
  },
  budgetHours: {
    type: Number,
    min: 0,
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "on-hold", "completed"],
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  targetDate: {
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

export default model<IProject>("Project", projectSchema);