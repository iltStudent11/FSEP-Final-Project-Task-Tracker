import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import mongoose from "mongoose";
import Claim from "../Claim";
import { connectTestDB, clearTestDB, disconnectTestDB } from "../../test/db";

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(disconnectTestDB);

const basePolicyId = () => new mongoose.Types.ObjectId();

describe("Claim model", () => {
  it("auto-generates sequential claim numbers", async () => {
    const claim1 = await Claim.create({
      policy: basePolicyId(),
      description: "Rear-end collision",
      incidentDate: new Date("2026-02-01"),
    });
    const claim2 = await Claim.create({
      policy: basePolicyId(),
      description: "Water damage",
      incidentDate: new Date("2026-02-02"),
    });

    expect(claim1.claimNumber).toMatch(/^CLM-\d+$/);
    const firstNumber = parseInt(claim1.claimNumber.replace("CLM-", ""), 10);
    expect(claim2.claimNumber).toBe(`CLM-${firstNumber + 1}`);
  });

  it("does not overwrite an existing claim number on update", async () => {
    const claim = await Claim.create({
      policy: basePolicyId(),
      description: "Fire damage",
      incidentDate: new Date("2026-02-01"),
    });
    const originalNumber = claim.claimNumber;

    claim.description = "Fire damage, updated";
    await claim.save();

    expect(claim.claimNumber).toBe(originalNumber);
  });

  it("defaults status to submitted", async () => {
    const claim = await Claim.create({
      policy: basePolicyId(),
      description: "Theft",
      incidentDate: new Date("2026-02-01"),
    });

    expect(claim.status).toBe("submitted");
  });

  it("requires description and incidentDate", async () => {
    await expect(
      Claim.create({ policy: basePolicyId() } as never),
    ).rejects.toThrow();
  });

  it("rejects a negative amount", async () => {
    await expect(
      Claim.create({
        policy: basePolicyId(),
        description: "Vandalism",
        incidentDate: new Date("2026-02-01"),
        amount: -100,
      }),
    ).rejects.toThrow();
  });

  it("rejects an invalid status", async () => {
    await expect(
      Claim.create({
        policy: basePolicyId(),
        description: "Vandalism",
        incidentDate: new Date("2026-02-01"),
        status: "bogus",
      } as never),
    ).rejects.toThrow();
  });

  it("appends notes with author, text, and createdAt", async () => {
    const authorId = new mongoose.Types.ObjectId();
    const claim = await Claim.create({
      policy: basePolicyId(),
      description: "Hail damage",
      incidentDate: new Date("2026-02-01"),
    });

    claim.notes.push({ author: authorId, text: "Reviewed", createdAt: new Date() });
    await claim.save();

    expect(claim.notes).toHaveLength(1);
    expect(claim.notes[0]?.text).toBe("Reviewed");
    expect(claim.notes[0]?.author.toString()).toBe(authorId.toString());
  });

  it("sets createdAt and updatedAt via timestamps", async () => {
    const claim = await Claim.create({
      policy: basePolicyId(),
      description: "Broken window",
      incidentDate: new Date("2026-02-01"),
    });

    expect(claim.createdAt).toBeInstanceOf(Date);
    expect(claim.updatedAt).toBeInstanceOf(Date);
  });
});
