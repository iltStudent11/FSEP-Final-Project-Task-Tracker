import type { TaskStatus } from "./types";

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in-progress",
  "blocked",
  "done",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  blocked: "Blocked",
  done: "Done",
};

/** Semantic tone for each status — drives both badge color and chart bar color. */
export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  todo: "info",
  "in-progress": "warning",
  blocked: "danger",
  done: "success",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "var(--color-info)",
  "in-progress": "var(--color-warning)",
  blocked: "var(--color-danger)",
  done: "var(--color-success)",
};
