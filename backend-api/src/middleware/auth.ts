import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import type { UserRole } from "../models/User";

interface AccessTokenPayload {
  id: string;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or malformed authorization header" });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    res.status(401).json({ message: "Missing or malformed authorization header" });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ message: "Server misconfiguration: missing JWT secret" });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as AccessTokenPayload;
    const user = await User.findById(payload.id);

    if (!user) {
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function authorizeRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Missing or malformed authorization header" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden: insufficient permissions" });
      return;
    }

    next();
  };
}
