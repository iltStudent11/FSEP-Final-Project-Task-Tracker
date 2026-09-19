import { Router, type Request, type Response } from "express";
import { body, param, query } from "express-validator";
import type { QueryFilter } from "mongoose";
import Task, { type ITask, type TaskStatus } from "../models/Task";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

const TASK_STATUSES = ["todo", "in-progress", "blocked", "done"];

router.get(
  "/",
  validate([
    query("status").optional().isIn(TASK_STATUSES).withMessage("Invalid task status"),
    query("project").optional().isMongoId().withMessage("Invalid project id"),
    query("assignedTo").optional().isMongoId().withMessage("Invalid assignedTo id"),
    query("search").optional().isString(),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
  ]),
  async (req: Request, res: Response) => {
    const { status, project, assignedTo, search } = req.query as Record<
      string,
      string | undefined
    >;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const filter: QueryFilter<ITask> = {};
    if (status) filter.status = status as TaskStatus;
    if (project) filter.project = project;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ taskNumber: searchRegex }, { title: searchRegex }];
    }

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Task.countDocuments(filter),
    ]);

    res.status(200).json({
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  },
);

router.get("/stats", async (_req: Request, res: Response) => {
  const [result] = await Task.aggregate([
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        totals: [
          {
            $group: {
              _id: null,
              totalTasks: { $sum: 1 },
              totalEstimateHours: { $sum: { $ifNull: ["$estimateHours", 0] } },
            },
          },
        ],
      },
    },
  ]);

  const byStatus = Object.fromEntries(TASK_STATUSES.map((status) => [status, 0]));
  for (const { _id, count } of result.byStatus as { _id: TaskStatus; count: number }[]) {
    byStatus[_id] = count;
  }

  const totals = result.totals[0] ?? { totalTasks: 0, totalEstimateHours: 0 };

  res.status(200).json({
    totalTasks: totals.totalTasks,
    totalEstimateHours: totals.totalEstimateHours,
    byStatus,
  });
});

router.get(
  "/:id",
  validate([param("id").isMongoId().withMessage("Invalid task id")]),
  async (req: Request, res: Response) => {
    const task = await Task.findById(req.params.id)
      .populate("project")
      .populate("assignedTo", "-password");

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.status(200).json({ task });
  },
);

router.post(
  "/",
  validate([
    body("project").isMongoId().withMessage("A valid project id is required"),
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("dueDate").isISO8601().withMessage("Due date must be a valid date"),
    body("estimateHours")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Estimate hours must be a non-negative number"),
  ]),
  async (req: Request, res: Response) => {
    const { project, title, dueDate, estimateHours } = req.body;

    const task = await Task.create({
      project,
      title,
      dueDate,
      estimateHours,
      assignedTo: req.user!._id,
    });

    res.status(201).json({ task });
  },
);

router.put(
  "/:id",
  validate([
    param("id").isMongoId().withMessage("Invalid task id"),
    body("project").optional().isMongoId().withMessage("Invalid project id"),
    body("title").optional().trim().notEmpty().withMessage("Title cannot be empty"),
    body("dueDate").optional().isISO8601().withMessage("Due date must be a valid date"),
    body("estimateHours")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Estimate hours must be a non-negative number"),
    body("status").optional().isIn(TASK_STATUSES).withMessage("Invalid task status"),
    body("assignedTo").optional().isMongoId().withMessage("Invalid assignedTo id"),
  ]),
  async (req: Request, res: Response) => {
    const { project, title, dueDate, estimateHours, status, assignedTo } = req.body;

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { project, title, dueDate, estimateHours, status, assignedTo },
      { new: true, runValidators: true },
    );

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.status(200).json({ task });
  },
);

router.post(
  "/:id/notes",
  validate([
    param("id").isMongoId().withMessage("Invalid task id"),
    body("text").trim().notEmpty().withMessage("Note text is required"),
  ]),
  async (req: Request, res: Response) => {
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    task.notes.push({
      author: req.user!._id,
      text: req.body.text,
      createdAt: new Date(),
    });
    await task.save();

    res.status(201).json({ task });
  },
);

router.delete(
  "/:id",
  validate([param("id").isMongoId().withMessage("Invalid task id")]),
  async (req: Request, res: Response) => {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.status(204).send();
  },
);

export default router;