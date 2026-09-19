import { Router, type Request, type Response } from "express";
import { body, param, query } from "express-validator";
import type { QueryFilter } from "mongoose";
import Policy, { type IPolicy, type PolicyType, type PolicyStatus } from "../models/Policy";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

const POLICY_TYPES = ["auto", "home", "life"];
const POLICY_STATUSES = ["active", "expired", "cancelled"];

router.get(
  "/",
  validate([
    query("type").optional().isIn(POLICY_TYPES).withMessage("Invalid policy type"),
    query("status").optional().isIn(POLICY_STATUSES).withMessage("Invalid policy status"),
    query("search").optional().isString(),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
  ]),
  async (req: Request, res: Response) => {
    const { type, status, search } = req.query as Record<string, string | undefined>;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const filter: QueryFilter<IPolicy> = {};
    if (type) filter.type = type as PolicyType;
    if (status) filter.status = status as PolicyStatus;
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ holderName: searchRegex }, { policyNumber: searchRegex }];
    }

    const [policies, total] = await Promise.all([
      Policy.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Policy.countDocuments(filter),
    ]);

    res.status(200).json({
      policies,
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
  validate([param("id").isMongoId().withMessage("Invalid policy id")]),
  async (req: Request, res: Response) => {
    const policy = await Policy.findById(req.params.id).populate("owner", "-password");

    if (!policy) {
      res.status(404).json({ message: "Policy not found" });
      return;
    }

    res.status(200).json({ policy });
  },
);

router.post(
  "/",
  validate([
    body("policyNumber").trim().notEmpty().withMessage("Policy number is required"),
    body("holderName").trim().notEmpty().withMessage("Holder name is required"),
    body("type").isIn(POLICY_TYPES).withMessage("Invalid policy type"),
    body("premium").isFloat({ min: 0 }).withMessage("Premium must be a non-negative number"),
    body("status").isIn(POLICY_STATUSES).withMessage("Invalid policy status"),
    body("effectiveDate").isISO8601().withMessage("Effective date must be a valid date"),
    body("expirationDate").isISO8601().withMessage("Expiration date must be a valid date"),
  ]),
  async (req: Request, res: Response) => {
    const { policyNumber, holderName, type, premium, status, effectiveDate, expirationDate } =
      req.body;

    const policy = await Policy.create({
      policyNumber,
      holderName,
      type,
      premium,
      status,
      effectiveDate,
      expirationDate,
      owner: req.user!._id,
    });

    res.status(201).json({ policy });
  },
);

router.put(
  "/:id",
  validate([
    param("id").isMongoId().withMessage("Invalid policy id"),
    body("policyNumber").optional().trim().notEmpty().withMessage("Policy number cannot be empty"),
    body("holderName").optional().trim().notEmpty().withMessage("Holder name cannot be empty"),
    body("type").optional().isIn(POLICY_TYPES).withMessage("Invalid policy type"),
    body("premium")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Premium must be a non-negative number"),
    body("status").optional().isIn(POLICY_STATUSES).withMessage("Invalid policy status"),
    body("effectiveDate").optional().isISO8601().withMessage("Effective date must be a valid date"),
    body("expirationDate")
      .optional()
      .isISO8601()
      .withMessage("Expiration date must be a valid date"),
  ]),
  async (req: Request, res: Response) => {
    const { policyNumber, holderName, type, premium, status, effectiveDate, expirationDate } =
      req.body;

    const policy = await Policy.findById(req.params.id);

    if (!policy) {
      res.status(404).json({ message: "Policy not found" });
      return;
    }

    Object.assign(policy, {
      policyNumber,
      holderName,
      type,
      premium,
      status,
      effectiveDate,
      expirationDate,
    });
    await policy.save();

    res.status(200).json({ policy });
  },
);

router.delete(
  "/:id",
  validate([param("id").isMongoId().withMessage("Invalid policy id")]),
  async (req: Request, res: Response) => {
    const policy = await Policy.findByIdAndDelete(req.params.id);

    if (!policy) {
      res.status(404).json({ message: "Policy not found" });
      return;
    }

    res.status(204).send();
  },
);

export default router;