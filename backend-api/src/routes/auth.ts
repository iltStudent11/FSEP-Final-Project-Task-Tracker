import { Router, type Request, type Response } from "express";
import { body } from "express-validator";
import User from "../models/User";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { generateToken, getTokenTimestamps } from "../utils/token";

const router = Router();

router.post(
  "/register",
  validate([
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("A valid email is required").normalizeEmail(),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    body("role").optional().isIn(["adjuster", "admin"]).withMessage("Invalid role"),
  ]),
  async (req: Request, res: Response) => {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ message: "Email is already registered" });
      return;
    }

    const user = await User.create({ name, email, password, ...(role && { role }) });

    res.status(201).json({ user });
  },
);

router.post(
  "/login",
  validate([
    body("email").isEmail().withMessage("A valid email is required").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ]),
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = generateToken(user);
    const { expiresAt } = getTokenTimestamps(token);

    res.status(200).json({ token, expiresAt, user });
  },
);

router.get("/me", authenticate, (req: Request, res: Response) => {
  res.status(200).json({ user: req.user });
});

export default router;