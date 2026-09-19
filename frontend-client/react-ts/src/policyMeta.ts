import type { ProjectCategory, ProjectStatus } from "./types";

export const PROJECT_CATEGORIES: ProjectCategory[] = ["web", "mobile", "data"];

export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  web: "Web",
  mobile: "Mobile",
  data: "Data",
};

export const PROJECT_STATUSES: ProjectStatus[] = ["active", "on-hold", "completed"];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  "on-hold": "On Hold",
  completed: "Completed",
};

/** Semantic tone for each status — drives badge color. */
export const PROJECT_STATUS_TONE: Record<ProjectStatus, string> = {
  active: "success",
  "on-hold": "warning",
  completed: "info",
};
