import jwt from "jsonwebtoken";
import type { IUser } from "../models/User";

const JWT_EXPIRES_IN = "60m";

export function generateToken(user: IUser): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("Missing JWT_SECRET environment variable");
  }

  return jwt.sign({ id: user._id.toString(), role: user.role }, jwtSecret, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function getTokenTimestamps(token: string): {
  createdAt: string;
  expiresAt: string;
} {
  const payload = jwt.decode(token);

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number"
  ) {
    throw new Error("Token is missing timestamps");
  }

  return {
    createdAt: new Date(payload.iat * 1000).toISOString(),
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}