import { Schema, model, type Document, type Types } from "mongoose";

export type TaskStatus = "todo" | "in-progress" | "blocked" | "done";

export interface ITaskNote {
  author: Types.ObjectId;
  text: string;
  createdAt: Date;
}

export interface ITask extends Document {
  taskNumber: string;
  project: Types.ObjectId;
  title: string;
  dueDate: Date;
  estimateHours: number;
  status: TaskStatus;
  assignedTo: Types.ObjectId;
  notes: Types.DocumentArray<ITaskNote>;
  createdAt: Date;
  updatedAt: Date;
}

const TASK_NUMBER_PREFIX = "TSK-";
const TASK_NUMBER_START = 1000;

const taskNoteSchema = new Schema<ITaskNote>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const taskSchema = new Schema<ITask>(
  {
    taskNumber: {
      type: String,
      unique: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    estimateHours: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ["todo", "in-progress", "blocked", "done"],
      default: "todo",
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    notes: [taskNoteSchema],
  },
  { timestamps: true },
);

taskSchema.pre("save", async function () {
  if (!this.isNew || this.taskNumber) return;

  const TaskModel = this.constructor as typeof Task;
  const count = await TaskModel.countDocuments();
  this.taskNumber = `${TASK_NUMBER_PREFIX}${TASK_NUMBER_START + count}`;
});

const Task = model<ITask>("Task", taskSchema);

export default Task;