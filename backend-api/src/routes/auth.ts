import { Router, type Request, type Response } from "express";
import { body, param } from "express-validator";
import User from "../models/User";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { generateToken, getTokenTimestamps } from "../utils/token";
import { logAuditEvent } from "../utils/audit";

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
 *               role: { type: string, enum: [admin, member, lead], example: member }
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
    body("role").optional().isIn(["admin", "member", "lead"]).withMessage("Invalid role"),
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

    await logAuditEvent({
      req,
      actor: user,
      eventType: "auth",
      action: "User login",
      targetType: "user",
      targetId: user._id.toString(),
      details: {
        email: user.email,
      },
    });

    res.status(200).json({ token, expiresAt, user });
  },
);

router.post("/logout", authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: "Missing or malformed authorization header" });
    return;
  }

  await logAuditEvent({
    req,
    actor: req.user,
    eventType: "auth",
    action: "User logout",
    targetType: "user",
    targetId: req.user._id.toString(),
    details: {
      email: req.user.email,
    },
  });

  res.status(200).json({ ok: true });
});

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

/**
 * @openapi
 * /auth/users/{id}:
 *   put:
 *     tags: [Auth]
 *     summary: Admin updates a user's profile
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
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [admin, member, lead] }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put(
  "/users/:id",
  authenticate,
  authorizeRoles("admin"),
  validate([
    param("id").isMongoId().withMessage("Invalid user id"),
    body().custom((value) => {
      const hasAnyField = ["name", "email", "role", "password"].some(
        (field) => Object.prototype.hasOwnProperty.call(value, field),
      );

      if (!hasAnyField) {
        throw new Error("At least one user field is required");
      }

      return true;
    }),
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("email").optional().isEmail().withMessage("A valid email is required").normalizeEmail(),
    body("role").optional().isIn(["admin", "member", "lead"]).withMessage("Invalid role"),
    body("password")
      .optional()
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
  ]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, email, role, password } = req.body as {
      name?: string;
      email?: string;
      role?: "admin" | "member" | "lead";
      password?: string;
    };

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== id) {
        res.status(409).json({ message: "Email is already registered" });
        return;
      }
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (password !== undefined) user.password = password;

    await user.save();

    res.status(200).json({ user });
  },
);

/**
 * @openapi
 * /auth/users/{id}:
 *   delete:
 *     tags: [Auth]
 *     summary: Admin deletes a user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: User deleted
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete(
  "/users/:id",
  authenticate,
  authorizeRoles("admin"),
  validate([param("id").isMongoId().withMessage("Invalid user id")]),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(204).send();
  },
);

export default router;