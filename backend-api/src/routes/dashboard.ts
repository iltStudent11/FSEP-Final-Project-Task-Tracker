import { Router, type Request, type Response } from "express";
import Task, { type TaskStatus } from "../models/Task";
import Project, { type ProjectCategory } from "../models/Project";
import User from "../models/User";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

const TASK_STATUSES = ["todo", "in-progress", "blocked", "done"];
const PROJECT_CATEGORIES = ["web", "mobile", "data"];

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
