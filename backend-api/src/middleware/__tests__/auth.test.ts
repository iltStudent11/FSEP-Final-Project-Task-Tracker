import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authenticate } from "../auth";
import User from "../../models/User";

vi.mock("../../models/User", () => ({
  default: { findById: vi.fn() },
}));

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

describe("authenticate middleware", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const req = { headers: {} } as Request;
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next as NextFunction);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for a malformed Authorization header", async () => {
    const req = { headers: { authorization: "Token abc" } } as Request;
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next as NextFunction);

    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for an invalid or expired token", async () => {
    const req = { headers: { authorization: "Bearer not-a-real-token" } } as Request;
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next as NextFunction);

    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when the token's user no longer exists", async () => {
    const token = jwt.sign({ id: "507f1f77bcf86cd799439011" }, "test-secret");
    vi.mocked(User.findById).mockResolvedValue(null);
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next as NextFunction);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches the user to the request and calls next for a valid token", async () => {
    const token = jwt.sign({ id: "507f1f77bcf86cd799439011" }, "test-secret");
    const fakeUser = { _id: "507f1f77bcf86cd799439011", role: "adjuster" };
    vi.mocked(User.findById).mockResolvedValue(fakeUser as never);
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBe(fakeUser);
  });

  it("returns 500 when JWT_SECRET is not configured", async () => {
    delete process.env.JWT_SECRET;
    const req = { headers: { authorization: "Bearer sometoken" } } as Request;
    const res = createMockRes();
    const next = vi.fn();

    await authenticate(req, res, next as NextFunction);

    expect(res.statusCode).toBe(500);
  });
});
