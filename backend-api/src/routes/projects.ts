import { Router, type Request, type Response } from "express";
import { body, param, query } from "express-validator";
import type { QueryFilter } from "mongoose";
import Project, {
  type IProject,
  type ProjectCategory,
  type ProjectStatus,
} from "../models/Project";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

const PROJECT_CATEGORIES = ["web", "mobile", "data"];
const PROJECT_STATUSES = ["active", "on-hold", "completed"];

router.get(
  "/",
  validate([
    query("category").optional().isIn(PROJECT_CATEGORIES).withMessage("Invalid project category"),
    query("status").optional().isIn(PROJECT_STATUSES).withMessage("Invalid project status"),
    query("search").optional().isString(),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
  ]),
  async (req: Request, res: Response) => {
    const { category, status, search } = req.query as Record<string, string | undefined>;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const filter: QueryFilter<IProject> = {};
    if (category) filter.category = category as ProjectCategory;
    if (status) filter.status = status as ProjectStatus;
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: searchRegex }, { projectCode: searchRegex }];
    }

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Project.countDocuments(filter),
    ]);

    res.status(200).json({
      projects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  },
);

router.get(
  "/:id",
  validate([param("id").isMongoId().withMessage("Invalid project id")]),
  async (req: Request, res: Response) => {
    const project = await Project.findById(req.params.id).populate("owner", "-password");

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.status(200).json({ project });
  },
);

router.post(
  "/",
  validate([
    body("projectCode").trim().notEmpty().withMessage("Project code is required"),
    body("name").trim().notEmpty().withMessage("Project name is required"),
    body("category").isIn(PROJECT_CATEGORIES).withMessage("Invalid project category"),
    body("budgetHours")
      .isFloat({ min: 0 })
      .withMessage("Budget hours must be a non-negative number"),
    body("status").isIn(PROJECT_STATUSES).withMessage("Invalid project status"),
    body("startDate").isISO8601().withMessage("Start date must be a valid date"),
    body("targetDate").isISO8601().withMessage("Target date must be a valid date"),
  ]),
  async (req: Request, res: Response) => {
    const { projectCode, name, category, budgetHours, status, startDate, targetDate } = req.body;

    const project = await Project.create({
      projectCode,
      name,
      category,
      budgetHours,
      status,
      startDate,
      targetDate,
      owner: req.user!._id,
    });

    res.status(201).json({ project });
  },
);

router.put(
  "/:id",
  validate([
    param("id").isMongoId().withMessage("Invalid project id"),
    body("projectCode").optional().trim().notEmpty().withMessage("Project code cannot be empty"),
    body("name").optional().trim().notEmpty().withMessage("Project name cannot be empty"),
    body("category").optional().isIn(PROJECT_CATEGORIES).withMessage("Invalid project category"),
    body("budgetHours")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Budget hours must be a non-negative number"),
    body("status").optional().isIn(PROJECT_STATUSES).withMessage("Invalid project status"),
    body("startDate").optional().isISO8601().withMessage("Start date must be a valid date"),
    body("targetDate").optional().isISO8601().withMessage("Target date must be a valid date"),
  ]),
  async (req: Request, res: Response) => {
    const { projectCode, name, category, budgetHours, status, startDate, targetDate } = req.body;

    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    Object.assign(project, {
      projectCode,
      name,
      category,
      budgetHours,
      status,
      startDate,
      targetDate,
    });
    await project.save();

    res.status(200).json({ project });
  },
);

router.delete(
  "/:id",
  validate([param("id").isMongoId().withMessage("Invalid project id")]),
  async (req: Request, res: Response) => {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.status(204).send();
  },
);

export default router;