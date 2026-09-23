import { Router, type Request, type Response } from "express";
import { body } from "express-validator";
import User from "../models/User";
import Project from "../models/Project";
import Task from "../models/Task";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate, authorizeRoles("admin"));

const BACKUP_VERSION = 1;

/**
 * @openapi
 * /admin/backup:
 *   get:
 *     tags: [Admin]
 *     summary: Download a full JSON backup of the database
 *     description: >
 *       Admin only. Dumps every `User` (including the bcrypt password hash — this
 *       is a full backup, not a public listing), `Project`, and `Task` document as
 *       plain JSON, with a `Content-Disposition` header so a browser saves it as a
 *       file. Restore it with `POST /admin/restore`.
 *     responses:
 *       200:
 *         description: Backup file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version: { type: integer, example: 1 }
 *                 exportedAt: { type: string, format: date-time }
 *                 users: { type: array, items: { type: object } }
 *                 projects: { type: array, items: { type: object } }
 *                 tasks: { type: array, items: { type: object } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get("/backup", async (_req: Request, res: Response) => {
  const [users, projects, tasks] = await Promise.all([
    User.find().lean(),
    Project.find().lean(),
    Task.find().lean(),
  ]);

  const exportedAt = new Date().toISOString();
  const filename = `task-tracker-backup-${exportedAt.slice(0, 10)}.json`;

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).json({
    version: BACKUP_VERSION,
    exportedAt,
    users,
    projects,
    tasks,
  });
});

/**
 * @openapi
 * /admin/restore:
 *   post:
 *     tags: [Admin]
 *     summary: Replace the database with a JSON backup
 *     description: >
 *       Admin only, and **destructive**: every existing `User`, `Project`, and `Task`
 *       document is permanently deleted and replaced with the contents of the
 *       uploaded backup (the shape returned by `GET /admin/backup`). Documents are
 *       inserted with their original `_id`s via `insertMany`, which bypasses
 *       Mongoose's `pre("save")` hooks — user passwords are restored exactly as the
 *       already-hashed values in the backup, not re-hashed. There is no rollback if
 *       the restore fails partway through: this runs against a standalone MongoDB
 *       instance (no replica set), which does not support multi-document
 *       transactions, so the delete-then-insert sequence is not atomic.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [users, projects, tasks]
 *             properties:
 *               version: { type: integer }
 *               exportedAt: { type: string, format: date-time }
 *               users: { type: array, items: { type: object } }
 *               projects: { type: array, items: { type: object } }
 *               tasks: { type: array, items: { type: object } }
 *     responses:
 *       200:
 *         description: Restore complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 counts:
 *                   type: object
 *                   properties:
 *                     users: { type: integer }
 *                     projects: { type: integer }
 *                     tasks: { type: integer }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post(
  "/restore",
  validate([
    body("users").isArray().withMessage("users must be an array"),
    body("projects").isArray().withMessage("projects must be an array"),
    body("tasks").isArray().withMessage("tasks must be an array"),
  ]),
  async (req: Request, res: Response) => {
    const { users, projects, tasks } = req.body as {
      users: unknown[];
      projects: unknown[];
      tasks: unknown[];
    };

    await Promise.all([User.deleteMany({}), Project.deleteMany({}), Task.deleteMany({})]);

    const [insertedUsers, insertedProjects, insertedTasks] = await Promise.all([
      users.length ? User.insertMany(users) : [],
      projects.length ? Project.insertMany(projects) : [],
      tasks.length ? Task.insertMany(tasks) : [],
    ]);

    res.status(200).json({
      message: "Restore complete",
      counts: {
        users: insertedUsers.length,
        projects: insertedProjects.length,
        tasks: insertedTasks.length,
      },
    });
  },
);

export default router;
