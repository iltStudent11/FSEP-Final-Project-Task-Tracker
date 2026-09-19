import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

interface MongoServerError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.fromEntries(
      Object.entries(err.errors).map(([field, fieldError]) => [field, fieldError.message]),
    );
    res.status(400).json({ message: "Validation failed", errors });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ message: `Invalid value for field "${err.path}"` });
    return;
  }

  const mongoErr = err as MongoServerError;
  if (mongoErr.code === 11000) {
    const field = mongoErr.keyValue ? Object.keys(mongoErr.keyValue)[0] : "field";
    res.status(409).json({ message: `A record with that ${field} already exists` });
    return;
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}
