import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { body } from "express-validator";
import { validate } from "../validate";

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

describe("validate middleware", () => {
  it("calls next when all validation chains pass", async () => {
    const req = { body: { email: "a@example.com" }, query: {}, params: {}, headers: {} };
    const res = createMockRes();
    const next = vi.fn();

    await validate([body("email").isEmail()])(req as unknown as Request, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it("returns 400 with error details when a chain fails", async () => {
    const req = { body: { email: "not-an-email" }, query: {}, params: {}, headers: {} };
    const res = createMockRes();
    const next = vi.fn();

    await validate([body("email").isEmail().withMessage("Invalid email")])(
      req as unknown as Request,
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect((res.body as { errors: { msg: string }[] }).errors[0]?.msg).toBe("Invalid email");
  });

  it("runs all provided chains, not just the first", async () => {
    const req = { body: { email: "not-an-email", name: "" }, query: {}, params: {}, headers: {} };
    const res = createMockRes();
    const next = vi.fn();

    await validate([
      body("email").isEmail().withMessage("Invalid email"),
      body("name").notEmpty().withMessage("Name is required"),
    ])(req as unknown as Request, res, next);

    const messages = (res.body as { errors: { msg: string }[] }).errors.map((e) => e.msg);
    expect(messages).toContain("Invalid email");
    expect(messages).toContain("Name is required");
  });
});
