import { Router, type Request, type Response } from "express";
import { body, param, query } from "express-validator";
import type { QueryFilter } from "mongoose";
import Task, { type ITask, type TaskStatus } from "../models/Task";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

const TASK_STATUSES = ["todo", "in-progress", "blocked", "done"];

function generateSubtaskSuggestions(title: string, description?: string) {
  const source = `${title} ${description ?? ""}`.toLowerCase();
  const suggestions: string[] = [];

  suggestions.push("Clarify acceptance criteria and edge cases");

  if (source.includes("api") || source.includes("backend") || source.includes("endpoint")) {
    suggestions.push("Implement endpoint/service logic");
    suggestions.push("Add request validation and error handling");
  }

  if (source.includes("ui") || source.includes("frontend") || source.includes("react")) {
    suggestions.push("Build UI interactions and loading/error states");
    suggestions.push("Connect UI to API contract");
  }

  if (source.includes("auth") || source.includes("login") || source.includes("token")) {
    suggestions.push("Add auth/permission checks for protected actions");
  }

  if (source.includes("test") || source.includes("qa") || source.includes("bug")) {
    suggestions.push("Write/extend automated tests for critical paths");
  } else {
    suggestions.push("Add/extend automated tests");
  }

  suggestions.push("Update docs and rollout notes");

  const unique = Array.from(new Set(suggestions));
  return unique.slice(0, 6);
}

/**
 * @openapi
 * /tasks/ai-suggest-subtasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Generate AI-style subtask suggestions from a task title
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Suggested subtasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subtasks:
 *                   type: array
 *                   items: { type: string }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post(
  "/ai-suggest-subtasks",
  validate([
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description").optional().isString().withMessage("Description must be a string"),
  ]),
  async (req: Request, res: Response) => {
    const { title, description } = req.body as { title: string; description?: string };
    const subtasks = generateSubtaskSuggestions(title, description);

    res.status(200).json({ subtasks });
  },
);

/**
 * Reconciles a task's status with its subtasks: completing every subtask
 * marks the task done (auto-assigning the current user if assignedTo/
 * completedBy aren't already set), and un-completing one moves a done task
 * back to in-progress. Returns an error message (and leaves the task
 * untouched) if the caller explicitly asked for `done` while subtasks are
 * still incomplete; returns null otherwise. No-ops for tasks with no
 * subtasks, so existing behavior is unchanged for them.
 */
function applySubtaskAutomation(
  task: {
    status: TaskStatus;
    subtasks: { completed: boolean }[];
    assignedTo?: unknown;
    completedBy?: unknown;
  },
  requestedStatus: TaskStatus | undefined,
  currentUserId: unknown,
): string | null {
  if (task.subtasks.length === 0) return null;

  const allCompleted = task.subtasks.every((subtask) => subtask.completed);

  if (requestedStatus === "done" && !allCompleted) {
    return "All subtasks must be completed before marking this task done";
  }

  if (allCompleted) {
    if (!task.assignedTo) task.assignedTo = currentUserId;
    if (!task.completedBy) task.completedBy = currentUserId;
    task.status = "done";
  } else if (task.status === "done") {
    task.status = "in-progress";
  }

  return null;
}

/**
 * @openapi
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [todo, in-progress, blocked, done] }
 *       - in: query
 *         name: project
 *         schema: { type: string }
 *       - in: query
 *         name: assignedTo
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches against task number or title
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200:
 *         description: Paginated tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Task' }
 *                 pagination: { $ref: '#/components/schemas/Pagination' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Tasks]
 *     summary: Create a task
 *     description: >
 *       Both `assignedTo` and `completedBy` are required when `status` is `done`. If
 *       `subtasks` are given and `status: done` is requested without every subtask
 *       completed, the request is rejected.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [project, title, dueDate]
 *             properties:
 *               project: { type: string, description: Project id }
 *               title: { type: string }
 *               description: { type: string }
 *               dueDate: { type: string, format: date }
 *               status: { type: string, enum: [todo, in-progress, blocked, done], default: todo }
 *               assignedTo: { type: string, description: User id }
 *               completedBy: { type: string, description: User id }
 *               estimateHours: { type: number, minimum: 0 }
 *               subtasks:
 *                 type: array
 *                 description: Subtask text lines; each is created incomplete.
 *                 items: { type: string }
 *                 example: ["Write code", "Write tests"]
 *     responses:
 *       201:
 *         description: Task created (taskNumber is auto-generated)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task: { $ref: '#/components/schemas/Task' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  "/",
  validate([
    query("status").optional().isIn(TASK_STATUSES).withMessage("Invalid task status"),
    query("project").optional().isMongoId().withMessage("Invalid project id"),
    query("assignedTo").optional().isMongoId().withMessage("Invalid assignedTo id"),
    query("completedBy").optional().isMongoId().withMessage("Invalid completedBy id"),
    query("search").optional().isString(),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
  ]),
  async (req: Request, res: Response) => {
    const { status, project, assignedTo, completedBy, search } = req.query as Record<
      string,
      string | undefined
    >;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const filter: QueryFilter<ITask> = {};
    if (status) filter.status = status as TaskStatus;
    if (project) filter.project = project;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (completedBy) filter.completedBy = completedBy;
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

/**
 * @openapi
 * /tasks/stats:
 *   get:
 *     tags: [Tasks]
 *     summary: Aggregated task statistics
 *     responses:
 *       200:
 *         description: Totals across all tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalTasks: { type: integer }
 *                 totalEstimateHours: { type: number }
 *                 byStatus:
 *                   type: object
 *                   additionalProperties: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
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

/**
 * @openapi
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get a single task (project + assignee populated)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task: { $ref: '#/components/schemas/Task' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     tags: [Tasks]
 *     summary: Update a task
 *     description: >
 *       `assignedTo`/`completedBy` are locked once a task is `done`, and both are
 *       required if the update sets (or keeps) `status: done`. If the task has
 *       subtasks, requesting `status: done` is rejected unless every subtask is
 *       already completed; conversely, completing every subtask (via the subtask
 *       endpoint) auto-marks the task done, and un-completing one moves it back
 *       to `in-progress`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               project: { type: string }
 *               title: { type: string }
 *               description: { type: string }
 *               dueDate: { type: string, format: date }
 *               estimateHours: { type: number, minimum: 0 }
 *               status: { type: string, enum: [todo, in-progress, blocked, done] }
 *               assignedTo: { type: string }
 *               completedBy: { type: string }
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task: { $ref: '#/components/schemas/Task' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Deleted }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/:id",
  validate([param("id").isMongoId().withMessage("Invalid task id")]),
  async (req: Request, res: Response) => {
    const task = await Task.findById(req.params.id)
      .populate("project")
      .populate("assignedTo", "-password")
      .populate("completedBy", "-password");

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
    body("description").optional().isString().withMessage("Description must be a string"),
    body("dueDate").isISO8601().withMessage("Due date must be a valid date"),
    body("status").optional().isIn(TASK_STATUSES).withMessage("Invalid task status"),
    body("assignedTo").optional().isMongoId().withMessage("Invalid assignedTo id"),
    body("completedBy").optional().isMongoId().withMessage("Invalid completedBy id"),
    body("estimateHours")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Estimate hours must be a non-negative number"),
    body("subtasks").optional().isArray().withMessage("subtasks must be an array"),
    body("subtasks.*")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Each subtask must be a non-empty string"),
  ]),
  async (req: Request, res: Response) => {
    const {
      project,
      title,
      description,
      dueDate,
      estimateHours,
      status = "todo",
      assignedTo,
      completedBy,
      subtasks: subtaskTexts,
    } = req.body;

    const subtasks = ((subtaskTexts ?? []) as string[]).map((text) => ({
      text,
      completed: false,
    }));

    const draft = { status, subtasks, assignedTo, completedBy };
    const automationError = applySubtaskAutomation(draft, status, req.user!._id);
    if (automationError) {
      res.status(400).json({ message: automationError });
      return;
    }

    if (draft.status === "done" && (!draft.assignedTo || !draft.completedBy)) {
      res.status(400).json({
        message: "Both assignedTo and completedBy are required when status is done",
      });
      return;
    }

    const task = await Task.create({
      project,
      title,
      description,
      dueDate,
      estimateHours,
      status: draft.status,
      assignedTo: draft.assignedTo,
      completedBy: draft.completedBy,
      subtasks,
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
    body("description").optional().isString().withMessage("Description must be a string"),
    body("dueDate").optional().isISO8601().withMessage("Due date must be a valid date"),
    body("estimateHours")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Estimate hours must be a non-negative number"),
    body("status").optional().isIn(TASK_STATUSES).withMessage("Invalid task status"),
    body("assignedTo").optional().isMongoId().withMessage("Invalid assignedTo id"),
    body("completedBy").optional().isMongoId().withMessage("Invalid completedBy id"),
  ]),
  async (req: Request, res: Response) => {
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    if (task.status === "done" && ("assignedTo" in req.body || "completedBy" in req.body)) {
      const currentAssignedTo = task.assignedTo?.toString() ?? "";
      const currentCompletedBy = task.completedBy?.toString() ?? "";
      const requestedAssignedTo = req.body.assignedTo ? String(req.body.assignedTo) : "";
      const requestedCompletedBy = req.body.completedBy ? String(req.body.completedBy) : "";

      const assignedToChanged = "assignedTo" in req.body && requestedAssignedTo !== currentAssignedTo;
      const completedByChanged =
        "completedBy" in req.body && requestedCompletedBy !== currentCompletedBy;

      if (assignedToChanged || completedByChanged) {
        res.status(400).json({
          message: "assignedTo and completedBy are locked once a task is marked done",
        });
        return;
      }
    }

    if ("project" in req.body) task.project = req.body.project;
    if ("title" in req.body) task.title = req.body.title;
    if ("description" in req.body) task.description = req.body.description;
    if ("dueDate" in req.body) task.dueDate = req.body.dueDate;
    if ("estimateHours" in req.body) task.estimateHours = req.body.estimateHours;
    if ("status" in req.body) task.status = req.body.status;
    if ("assignedTo" in req.body) task.assignedTo = req.body.assignedTo || undefined;
    if ("completedBy" in req.body) task.completedBy = req.body.completedBy || undefined;

    const requestedStatus = "status" in req.body ? (req.body.status as TaskStatus) : undefined;
    const automationError = applySubtaskAutomation(task, requestedStatus, req.user!._id);
    if (automationError) {
      res.status(400).json({ message: automationError });
      return;
    }

    if (task.status === "done" && (!task.assignedTo || !task.completedBy)) {
      res.status(400).json({
        message: "Both assignedTo and completedBy are required when status is done",
      });
      return;
    }

    await task.save();

    res.status(200).json({ task });
  },
);

/**
 * @openapi
 * /tasks/{id}/notes:
 *   post:
 *     tags: [Tasks]
 *     summary: Add a note to a task
 *     description: "Appends a note authored by the authenticated user to the task's notes."
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string }
 *     responses:
 *       201:
 *         description: Note added — returns the full updated task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task: { $ref: '#/components/schemas/Task' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
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

/**
 * @openapi
 * /tasks/{id}/subtasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Add a subtask to a task
 *     description: >
 *       Appends a new, incomplete subtask. If the task was auto-marked `done` because
 *       every previous subtask was completed, adding a new incomplete one moves it back
 *       to `in-progress`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string }
 *     responses:
 *       201:
 *         description: Subtask added — returns the full updated task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task: { $ref: '#/components/schemas/Task' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post(
  "/:id/subtasks",
  validate([
    param("id").isMongoId().withMessage("Invalid task id"),
    body("text").trim().notEmpty().withMessage("Subtask text is required"),
  ]),
  async (req: Request, res: Response) => {
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    task.subtasks.push({ text: req.body.text, completed: false });
    applySubtaskAutomation(task, undefined, req.user!._id);

    await task.save();

    res.status(201).json({ task });
  },
);

/**
 * @openapi
 * /tasks/{id}/subtasks/{subtaskId}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Mark a subtask complete or incomplete
 *     description: >
 *       Completing every subtask automatically marks the task `done` (auto-assigning
 *       the current user if `assignedTo`/`completedBy` aren't already set); un-completing
 *       one moves a `done` task back to `in-progress`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [completed]
 *             properties:
 *               completed: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task: { $ref: '#/components/schemas/Task' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/:id/subtasks/:subtaskId",
  validate([
    param("id").isMongoId().withMessage("Invalid task id"),
    param("subtaskId").isMongoId().withMessage("Invalid subtask id"),
    body("completed").isBoolean().withMessage("completed must be a boolean"),
  ]),
  async (req: Request, res: Response) => {
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const subtask = task.subtasks.id(req.params.subtaskId as string);

    if (!subtask) {
      res.status(404).json({ message: "Subtask not found" });
      return;
    }

    subtask.completed = req.body.completed;
    applySubtaskAutomation(task, undefined, req.user!._id);

    await task.save();

    res.status(200).json({ task });
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