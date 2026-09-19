import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import User from "../User";
import { connectTestDB, clearTestDB, disconnectTestDB } from "../../test/db";

beforeAll(async () => {
  await connectTestDB();
  await User.init();
});
afterEach(clearTestDB);
afterAll(disconnectTestDB);

describe("User model", () => {
  it("hashes the password before saving", async () => {
    const user = await User.create({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
    });

    expect(user.password).not.toBe("password123");
    expect(user.password.length).toBeGreaterThan(20);
  });

  it("comparePassword returns true for the correct password and false otherwise", async () => {
    const user = await User.create({
      name: "Bob",
      email: "bob@example.com",
      password: "password123",
    });

    await expect(user.comparePassword("password123")).resolves.toBe(true);
    await expect(user.comparePassword("wrong-password")).resolves.toBe(false);
  });

  it("does not rehash the password when other fields change", async () => {
    const user = await User.create({
      name: "Carol",
      email: "carol@example.com",
      password: "password123",
    });
    const originalHash = user.password;

    user.name = "Carol Updated";
    await user.save();

    expect(user.password).toBe(originalHash);
  });

  it("strips the password field from JSON output", async () => {
    const user = await User.create({
      name: "Dave",
      email: "dave@example.com",
      password: "password123",
    });

    expect(user.toJSON()).not.toHaveProperty("password");
    expect(JSON.stringify(user)).not.toContain("password123");
  });

  it("defaults role to adjuster", async () => {
    const user = await User.create({
      name: "Erin",
      email: "erin@example.com",
      password: "password123",
    });

    expect(user.role).toBe("adjuster");
  });

  it("rejects a duplicate email", async () => {
    await User.create({ name: "Frank", email: "dup@example.com", password: "password123" });

    await expect(
      User.create({ name: "Frank Two", email: "dup@example.com", password: "password123" }),
    ).rejects.toThrow();
  });

  it("rejects a password shorter than 8 characters", async () => {
    await expect(
      User.create({ name: "Grace", email: "grace@example.com", password: "short" }),
    ).rejects.toThrow();
  });
});
