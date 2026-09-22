/**
 * TypeScript types for the Project Task Tracker API (backend-api).
 * Mirrors the JSON shapes returned by the Express/Mongoose API.
 */

export type ObjectId = string;

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "member" | "lead";

export interface User {
  _id: ObjectId;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export type ProjectCategory = "web" | "mobile" | "data";
export type ProjectStatus = "active" | "on-hold" | "completed";

export interface Project {
  _id: ObjectId;
  projectCode: string;
  name: string;
  category: ProjectCategory;
  budgetHours: number;
  status: ProjectStatus;
  startDate: string;
  targetDate: string;
  /** A plain id on list/create/update responses; a populated User on GET /projects/:id. */
  owner: ObjectId | User;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export type TaskStatus = "todo" | "in-progress" | "blocked" | "done";

export interface TaskNote {
  /** A plain id on most responses; a populated User only where explicitly noted. */
  author: ObjectId | User;
  text: string;
  createdAt: string;
}

export interface Subtask {
  _id: ObjectId;
  text: string;
  completed: boolean;
}

export interface Task {
  _id: ObjectId;
  taskNumber: string;
  /** A plain id on list responses; a populated Project on GET /tasks/:id and in dashboard.recentTasks. */
  project: ObjectId | Project;
  title: string;
  description?: string;
  dueDate: string;
  estimateHours?: number;
  status: TaskStatus;
  /** A plain id on list responses; a populated User on GET /tasks/:id and in dashboard.recentTasks. */
  assignedTo?: ObjectId | User;
  completedBy?: ObjectId | User;
  notes: TaskNote[];
  /** Completing every subtask auto-marks the task done; un-completing one moves a done task back to in-progress. */
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Pagination (GET /projects, GET /tasks)
// ---------------------------------------------------------------------------

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedProjects {
  projects: Project[];
  pagination: Pagination;
}

export interface PaginatedTasks {
  tasks: Task[];
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// Stats & dashboard
// ---------------------------------------------------------------------------

export interface TaskStats {
  totalTasks: number;
  totalEstimateHours: number;
  byStatus: Record<TaskStatus, number>;
}

export interface DashboardStats {
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  totalProjects: number;
  projectsByCategory: Record<ProjectCategory, number>;
  totalUsers: number;
  /** Last 5 tasks, newest first, with `project` and `assignedTo` populated. */
  recentTasks: Task[];
  totalEstimateHours: number;
}

export interface AiStandupSummary {
  headline: string;
  yesterday: string[];
  today: string[];
  blockers: string[];
  riskLevel: "low" | "medium" | "high";
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface RegisterResponse {
  user: User;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface MeResponse {
  user: User;
}

export interface UsersResponse {
  users: User[];
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export type DbConnectionState = "connected" | "connecting" | "disconnecting" | "disconnected";

export interface HealthResponse {
  status: "ok" | "error";
  db: DbConnectionState;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** A single express-validator field error, as returned in ApiErrorResponse.errors. */
export interface ValidationFieldError {
  type: string;
  msg: string;
  path: string;
  location: string;
  value?: unknown;
}

/** Shape of every non-2xx JSON response from the API. */
export interface ApiErrorResponse {
  message?: string;
  errors?: ValidationFieldError[];
}
