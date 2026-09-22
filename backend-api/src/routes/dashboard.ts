import { Router, type Request, type Response } from "express";
import Task, { type TaskStatus } from "../models/Task";
import Project, { type ProjectCategory } from "../models/Project";
import User from "../models/User";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

const TASK_STATUSES = ["todo", "in-progress", "blocked", "done"];
const PROJECT_CATEGORIES = ["web", "mobile", "data"];

function formatTaskLabel(task: {
  taskNumber: string;
  title: string;
  project?: { projectCode?: string } | null;
}) {
  const projectCode = task.project?.projectCode ?? "N/A";
  return `${task.taskNumber} (${projectCode}) — ${task.title}`;
}

/**
 * @openapi
 * /dashboard/ai-standup:
 *   get:
 *     tags: [Dashboard]
 *     summary: Generate an AI-style standup summary from current tasks
 *     responses:
 *       200:
 *         description: Standup summary grouped into yesterday, today, and blockers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 headline: { type: string }
 *                 yesterday:
 *                   type: array
 *                   items: { type: string }
 *                 today:
 *                   type: array
 *                   items: { type: string }
 *                 blockers:
 *                   type: array
 *                   items: { type: string }
 *                 riskLevel:
 *                   type: string
 *                   enum: [low, medium, high]
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/ai-standup", async (_req: Request, res: Response) => {
  const now = new Date();

  const [recentDone, inProgressOrTodo, blocked, overdueOpenCount] = await Promise.all([
    Task.find({ status: "done" })
      .sort({ updatedAt: -1 })
      .limit(3)
      .populate("project", "projectCode"),
    Task.find({ status: { $in: ["in-progress", "todo"] } })
      .sort({ dueDate: 1 })
      .limit(3)
      .populate("project", "projectCode"),
    Task.find({ status: "blocked" })
      .sort({ updatedAt: -1 })
      .limit(3)
      .populate("project", "projectCode"),
    Task.countDocuments({
      status: { $ne: "done" },
      dueDate: { $lt: now },
    }),
  ]);

  const yesterday =
    recentDone.length > 0
      ? recentDone.map((task) => `Completed ${formatTaskLabel(task)}`)
      : ["No recently completed tasks yet."];

  const today =
    inProgressOrTodo.length > 0
      ? inProgressOrTodo.map((task) => {
          const dueText = task.dueDate
            ? `, due ${new Date(task.dueDate).toLocaleDateString("en-US")}`
            : "";
          return `Focus on ${formatTaskLabel(task)}${dueText}`;
        })
      : ["No active tasks in progress right now."];

  const blockers =
    blocked.length > 0
      ? blocked.map((task) => `Blocked: ${formatTaskLabel(task)}`)
      : ["No active blockers detected."];

  const riskLevel = blocked.length >= 3 || overdueOpenCount >= 5
    ? "high"
    : blocked.length >= 1 || overdueOpenCount >= 2
      ? "medium"
      : "low";

  const headline =
    riskLevel === "high"
      ? `Delivery risk is high: ${blocked.length} blockers and ${overdueOpenCount} overdue open tasks.`
      : riskLevel === "medium"
        ? `Delivery risk is medium: ${blocked.length} blockers and ${overdueOpenCount} overdue open tasks.`
        : `Delivery risk is low: ${blocked.length} blockers and ${overdueOpenCount} overdue open tasks.`;

  res.status(200).json({
    headline,
    yesterday,
    today,
    blockers,
    riskLevel,
  });
});

/**
 * @openapi
 * /dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Aggregated totals across tasks, projects, and users
 *     responses:
 *       200:
 *         description: Dashboard summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalTasks: { type: integer }
 *                 tasksByStatus:
 *                   type: object
 *                   additionalProperties: { type: integer }
 *                 totalProjects: { type: integer }
 *                 projectsByCategory:
 *                   type: object
 *                   additionalProperties: { type: integer }
 *                 totalUsers: { type: integer }
 *                 recentTasks:
 *                   type: array
 *                   description: Last 5 tasks, newest first, with project and assignedTo populated
 *                   items: { $ref: '#/components/schemas/Task' }
 *                 totalEstimateHours: { type: number }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/", async (_req: Request, res: Response) => {
  const [
    totalTasks,
    tasksByStatusRaw,
    totalProjects,
    projectsByCategoryRaw,
    totalUsers,
    recentTasks,
    totalEstimateHoursRaw,
  ] = await Promise.all([
    Task.countDocuments(),
    Task.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Project.countDocuments(),
    Project.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
    User.countDocuments(),
    Task.find().sort({ createdAt: -1 }).limit(5).populate("project").populate("assignedTo", "-password"),
    Task.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ["$estimateHours", 0] } } } },
    ]),
  ]);

  const tasksByStatus = Object.fromEntries(TASK_STATUSES.map((status) => [status, 0]));
  for (const { _id, count } of tasksByStatusRaw as { _id: TaskStatus; count: number }[]) {
    tasksByStatus[_id] = count;
  }

  const projectsByCategory = Object.fromEntries(PROJECT_CATEGORIES.map((type) => [type, 0]));
  for (const { _id, count } of projectsByCategoryRaw as { _id: ProjectCategory; count: number }[]) {
    projectsByCategory[_id] = count;
  }

  const totalEstimateHours = totalEstimateHoursRaw[0]?.total ?? 0;

  res.status(200).json({
    totalTasks,
    tasksByStatus,
    totalProjects,
    projectsByCategory,
    totalUsers,
    recentTasks,
    totalEstimateHours,
  });
});

export default router;
