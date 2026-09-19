import dotenv from "dotenv";

dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "./config/db";
import User, { type IUser } from "./models/User";
import Policy from "./models/Policy";
import Claim from "./models/Claim";

async function seed(): Promise<void> {
  await connectDB();

  console.log("Clearing existing data...");
  await Promise.all([User.deleteMany({}), Policy.deleteMany({}), Claim.deleteMany({})]);

  console.log("Creating users...");
  const [admin, alice, bob] = await Promise.all([
    User.create({
      name: "Admin User",
      email: "admin@policyclaims.com",
      password: "Admin123!",
      role: "admin",
    }),
    User.create({
      name: "Alice Adjuster",
      email: "alice@policyclaims.com",
      password: "Password123!",
      role: "adjuster",
    }),
    User.create({
      name: "Bob Adjuster",
      email: "bob@policyclaims.com",
      password: "Password123!",
      role: "adjuster",
    }),
  ]);

  console.log("Creating policies...");
  const [policy1, policy2, policy3, policy4, policy5] = await Promise.all([
    Policy.create({
      policyNumber: "POL-1001",
      holderName: "John Smith",
      type: "auto",
      premium: 850,
      status: "active",
      effectiveDate: new Date("2025-01-01"),
      expirationDate: new Date("2026-01-01"),
      owner: alice._id,
    }),
    Policy.create({
      policyNumber: "POL-1002",
      holderName: "Mary Johnson",
      type: "home",
      premium: 1200,
      status: "active",
      effectiveDate: new Date("2025-03-15"),
      expirationDate: new Date("2026-03-15"),
      owner: bob._id,
    }),
    Policy.create({
      policyNumber: "POL-1003",
      holderName: "Robert Lee",
      type: "life",
      premium: 300,
      status: "active",
      effectiveDate: new Date("2024-06-01"),
      expirationDate: new Date("2034-06-01"),
      owner: alice._id,
    }),
    Policy.create({
      policyNumber: "POL-1004",
      holderName: "Susan Clark",
      type: "auto",
      premium: 600,
      status: "expired",
      effectiveDate: new Date("2023-01-01"),
      expirationDate: new Date("2024-01-01"),
      owner: bob._id,
    }),
    Policy.create({
      policyNumber: "POL-1005",
      holderName: "David Kim",
      type: "home",
      premium: 950,
      status: "cancelled",
      effectiveDate: new Date("2024-09-01"),
      expirationDate: new Date("2025-09-01"),
      owner: alice._id,
    }),
  ]);

  console.log("Creating claims...");

  // Created sequentially: the Claim model auto-generates claimNumber in a
  // pre("save") hook based on countDocuments(), so concurrent creates would race.
  const claim1 = await Claim.create({
    policy: policy1._id,
    description: "Rear-end collision on I-95",
    incidentDate: new Date("2026-02-01"),
    amount: 3200,
    status: "submitted",
    assignedTo: alice._id,
  });

  const claim2 = await Claim.create({
    policy: policy2._id,
    description: "Kitchen fire damage",
    incidentDate: new Date("2026-01-20"),
    amount: 15000,
    status: "under-review",
    assignedTo: bob._id,
  });
  claim2.notes.push({
    author: bob._id,
    text: "Requested contractor estimate for smoke and structural damage.",
    createdAt: new Date("2026-01-22"),
  });
  await claim2.save();

  const claim3 = await Claim.create({
    policy: policy1._id,
    description: "Windshield crack from road debris",
    incidentDate: new Date("2026-02-10"),
    amount: 450,
    status: "approved",
    assignedTo: alice._id,
  });
  claim3.notes.push({
    author: admin._id,
    text: "Reviewed photos and repair quote, approved for payout.",
    createdAt: new Date("2026-02-12"),
  });
  await claim3.save();

  const claim4 = await Claim.create({
    policy: policy4._id,
    description: "Side collision in parking lot",
    incidentDate: new Date("2023-11-05"),
    amount: 2100,
    status: "denied",
    assignedTo: bob._id,
  });
  claim4.notes.push({
    author: bob._id,
    text: "Incident date falls after the policy's expiration date; claim denied.",
    createdAt: new Date("2023-11-10"),
  });
  await claim4.save();

  const claim5 = await Claim.create({
    policy: policy3._id,
    description: "Beneficiary claim filed after policyholder's passing",
    incidentDate: new Date("2025-12-01"),
    amount: 50000,
    status: "closed",
    assignedTo: alice._id,
  });
  claim5.notes.push(
    {
      author: alice._id,
      text: "Verified beneficiary documentation and death certificate.",
      createdAt: new Date("2025-12-05"),
    },
    {
      author: admin._id,
      text: "Payout processed and claim closed.",
      createdAt: new Date("2025-12-15"),
    },
  );
  await claim5.save();

  const claim6 = await Claim.create({
    policy: policy5._id,
    description: "Water damage from burst pipe",
    incidentDate: new Date("2026-01-05"),
    amount: 7800,
    status: "submitted",
    assignedTo: bob._id,
  });

  const users: IUser[] = [admin, alice, bob];
  console.log(`Seeded ${users.length} users, 5 policies, 6 claims.`);
  console.log(
    "Claim numbers:",
    [claim1, claim2, claim3, claim4, claim5, claim6].map((c) => c.claimNumber).join(", "),
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
