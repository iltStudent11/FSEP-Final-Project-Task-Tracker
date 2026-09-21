import { Router, type Request, type Response } from "express";
import { body } from "express-validator";
import User from "../models/User";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { generateToken, getTokenTimestamps } from "../utils/token";

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a user account
 *     description: Does not return a token — log in separately after registering.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: Jane Doe }
 *               email: { type: string, format: email, example: jane@example.com }
 *               password: { type: string, format: password, minLength: 8, example: Password123! }
 *               role: { type: string, enum: [adjuster, admin], example: adjuster }
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       409:
 *         description: Email is already registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
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

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate and receive a JWT
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: admin@tasktracker.com }
 *               password: { type: string, format: password, example: Admin123! }
 *     responses:
 *       200:
 *         description: Authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 expiresAt: { type: string, format: date-time }
 *                 user: { $ref: '#/components/schemas/User' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
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

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Return the authenticated user's profile
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/me", authenticate, (req: Request, res: Response) => {
  res.status(200).json({ user: req.user });
});

/**
 * @openapi
 * /auth/users:
 *   get:
 *     tags: [Auth]
 *     summary: List all users
 *     responses:
 *       200:
 *         description: Users, oldest first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/users", authenticate, async (_req: Request, res: Response) => {
  const users = await User.find().sort({ createdAt: 1 });
  res.status(200).json({ users });
});

export default router;