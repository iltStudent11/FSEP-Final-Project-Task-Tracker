import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import Policy from "../Policy";

const validAttrs = {
  policyNumber: "pol-100",
  holderName: "Jane Doe",
  type: "auto",
  premium: 500,
  status: "active",
  effectiveDate: new Date("2026-01-01"),
  expirationDate: new Date("2027-01-01"),
  owner: new mongoose.Types.ObjectId(),
};

describe("Policy model", () => {
  it("uppercases the policy number", () => {
    const policy = new Policy(validAttrs);
    expect(policy.policyNumber).toBe("POL-100");
  });

  it("trims the holder name", () => {
    const policy = new Policy({ ...validAttrs, holderName: "  Jane Doe  " });
    expect(policy.holderName).toBe("Jane Doe");
  });

  it("passes validation with all required fields present", async () => {
    const policy = new Policy(validAttrs);
    await expect(policy.validate()).resolves.toBeUndefined();
  });

  it("fails validation when required fields are missing", async () => {
    const policy = new Policy({});
    const err = await policy.validate().catch((e) => e);

    expect(err).toBeDefined();
    expect(err.errors.policyNumber).toBeDefined();
    expect(err.errors.holderName).toBeDefined();
    expect(err.errors.type).toBeDefined();
    expect(err.errors.premium).toBeDefined();
    expect(err.errors.status).toBeDefined();
    expect(err.errors.effectiveDate).toBeDefined();
    expect(err.errors.expirationDate).toBeDefined();
    expect(err.errors.owner).toBeDefined();
  });

  it("rejects an invalid policy type", async () => {
    const policy = new Policy({ ...validAttrs, type: "boat" });
    const err = await policy.validate().catch((e) => e);
    expect(err.errors.type).toBeDefined();
  });

  it("rejects an invalid status", async () => {
    const policy = new Policy({ ...validAttrs, status: "pending" });
    const err = await policy.validate().catch((e) => e);
    expect(err.errors.status).toBeDefined();
  });

  it("rejects a negative premium", async () => {
    const policy = new Policy({ ...validAttrs, premium: -5 });
    const err = await policy.validate().catch((e) => e);
    expect(err.errors.premium).toBeDefined();
  });
});
