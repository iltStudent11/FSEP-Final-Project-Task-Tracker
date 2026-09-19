import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { errorHandler } from "../errorHandler";

function createMockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & typeof res;
}

const TestSchema = new mongoose.Schema({ name: { type: String, required: true } });
const TestModel = mongoose.models.ErrorHandlerTestModel ?? mongoose.model("ErrorHandlerTestModel", TestSchema);

describe("errorHandler middleware", () => {
  it("returns 400 with field-level messages for a ValidationError", async () => {
    const doc = new TestModel({});
    const err = await doc.validate().catch((e: Error) => e);
    const res = createMockRes();

    errorHandler(err as Error, {} as Request, res, vi.fn() as NextFunction);

    expect(res.statusCode).toBe(400);
    expect((res.body as { errors: Record<string, string> }).errors.name).toContain("required");
  });

  it("returns 400 for a CastError", () => {
    const err = new mongoose.Error.CastError("ObjectId", "not-an-id", "policy");
    const res = createMockRes();

    errorHandler(err, {} as Request, res, vi.fn() as NextFunction);

    expect(res.statusCode).toBe(400);
    expect((res.body as { message: string }).message).toContain("policy");
  });

  it("returns 409 for a duplicate key error", () => {
    const err = Object.assign(new Error("duplicate key"), {
      code: 11000,
      keyValue: { email: "dup@example.com" },
    });
    const res = createMockRes();

    errorHandler(err, {} as Request, res, vi.fn() as NextFunction);

    expect(res.statusCode).toBe(409);
    expect((res.body as { message: string }).message).toContain("email");
  });

  it("returns 500 with a generic message and does not leak error details for unknown errors", () => {
    const err = new Error("some internal secret detail");
    const res = createMockRes();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    errorHandler(err, {} as Request, res, vi.fn() as NextFunction);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: "Internal server error" });
    expect(JSON.stringify(res.body)).not.toContain("secret detail");

    consoleSpy.mockRestore();
  });
});
