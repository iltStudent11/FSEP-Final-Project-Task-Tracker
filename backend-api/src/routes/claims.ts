import { Router, type Request, type Response } from "express";
import { body, param, query } from "express-validator";
import type { QueryFilter } from "mongoose";
import Claim, { type IClaim, type ClaimStatus } from "../models/Claim";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

const CLAIM_STATUSES = ["submitted", "under-review", "approved", "denied", "closed"];

router.get(
  "/",
  validate([
    query("status").optional().isIn(CLAIM_STATUSES).withMessage("Invalid claim status"),
    query("policy").optional().isMongoId().withMessage("Invalid policy id"),
    query("assignedTo").optional().isMongoId().withMessage("Invalid assignedTo id"),
    query("search").optional().isString(),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
  ]),
  async (req: Request, res: Response) => {
    const { status, policy, assignedTo, search } = req.query as Record<
      string,
      string | undefined
    >;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const filter: QueryFilter<IClaim> = {};
    if (status) filter.status = status as ClaimStatus;
    if (policy) filter.policy = policy;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ claimNumber: searchRegex }, { description: searchRegex }];
    }

    const [claims, total] = await Promise.all([
      Claim.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Claim.countDocuments(filter),
    ]);

    res.status(200).json({
      claims,
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
  const [result] = await Claim.aggregate([
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        totals: [
          {
            $group: {
              _id: null,
              totalClaims: { $sum: 1 },
              totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
            },
          },
        ],
      },
    },
  ]);

  const byStatus = Object.fromEntries(CLAIM_STATUSES.map((status) => [status, 0]));
  for (const { _id, count } of result.byStatus as { _id: ClaimStatus; count: number }[]) {
    byStatus[_id] = count;
  }

  const totals = result.totals[0] ?? { totalClaims: 0, totalAmount: 0 };

  res.status(200).json({
    totalClaims: totals.totalClaims,
    totalAmount: totals.totalAmount,
    byStatus,
  });
});

router.get(
  "/:id",
  validate([param("id").isMongoId().withMessage("Invalid claim id")]),
  async (req: Request, res: Response) => {
    const claim = await Claim.findById(req.params.id)
      .populate("policy")
      .populate("assignedTo", "-password");

    if (!claim) {
      res.status(404).json({ message: "Claim not found" });
      return;
    }

    res.status(200).json({ claim });
  },
);

router.post(
  "/",
  validate([
    body("policy").isMongoId().withMessage("A valid policy id is required"),
    body("description").trim().notEmpty().withMessage("Description is required"),
    body("incidentDate").isISO8601().withMessage("Incident date must be a valid date"),
    body("amount")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Amount must be a non-negative number"),
  ]),
  async (req: Request, res: Response) => {
    const { policy, description, incidentDate, amount } = req.body;

    const claim = await Claim.create({
      policy,
      description,
      incidentDate,
      amount,
      assignedTo: req.user!._id,
    });

    res.status(201).json({ claim });
  },
);

router.put(
  "/:id",
  validate([
    param("id").isMongoId().withMessage("Invalid claim id"),
    body("policy").optional().isMongoId().withMessage("Invalid policy id"),
    body("description").optional().trim().notEmpty().withMessage("Description cannot be empty"),
    body("incidentDate").optional().isISO8601().withMessage("Incident date must be a valid date"),
    body("amount")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Amount must be a non-negative number"),
    body("status").optional().isIn(CLAIM_STATUSES).withMessage("Invalid claim status"),
    body("assignedTo").optional().isMongoId().withMessage("Invalid assignedTo id"),
  ]),
  async (req: Request, res: Response) => {
    const { policy, description, incidentDate, amount, status, assignedTo } = req.body;

    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      { policy, description, incidentDate, amount, status, assignedTo },
      { new: true, runValidators: true },
    );

    if (!claim) {
      res.status(404).json({ message: "Claim not found" });
      return;
    }

    res.status(200).json({ claim });
  },
);

router.post(
  "/:id/notes",
  validate([
    param("id").isMongoId().withMessage("Invalid claim id"),
    body("text").trim().notEmpty().withMessage("Note text is required"),
  ]),
  async (req: Request, res: Response) => {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      res.status(404).json({ message: "Claim not found" });
      return;
    }

    claim.notes.push({
      author: req.user!._id,
      text: req.body.text,
      createdAt: new Date(),
    });
    await claim.save();

    res.status(201).json({ claim });
  },
);

router.delete(
  "/:id",
  validate([param("id").isMongoId().withMessage("Invalid claim id")]),
  async (req: Request, res: Response) => {
    const claim = await Claim.findByIdAndDelete(req.params.id);

    if (!claim) {
      res.status(404).json({ message: "Claim not found" });
      return;
    }

    res.status(204).send();
  },
);

export default router;
