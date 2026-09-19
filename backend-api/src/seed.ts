import dotenv from "dotenv";

dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "./config/db";
import User, { type IUser } from "./models/User";
import Project from "./models/Project";
import Task from "./models/Task";

async function seed(): Promise<void> {
  await connectDB();

  console.log("Clearing existing data...");
  await Promise.all([User.deleteMany({}), Project.deleteMany({}), Task.deleteMany({})]);

  console.log("Creating users...");
  const [admin, alice, bob] = await Promise.all([
    User.create({
      name: "Admin User",
      email: "admin@tasktracker.com",
      password: "Admin123!",
      role: "admin",
    }),
    User.create({
      name: "Alice Adjuster",
      email: "alice@tasktracker.com",
      password: "Password123!",
      role: "adjuster",
    }),
    User.create({
      name: "Bob Adjuster",
      email: "bob@tasktracker.com",
      password: "Password123!",
      role: "adjuster",
    }),
  ]);

  console.log("Creating projects...");
  const [project1, project2, project3, project4, project5] = await Promise.all([
    Project.create({
      projectCode: "PRJ-1001",
      name: "Customer Portal Refresh",
      category: "web",
      budgetHours: 450,
      status: "active",
      startDate: new Date("2026-01-01"),
      targetDate: new Date("2026-06-01"),
      owner: alice._id,
    }),
    Project.create({
      projectCode: "PRJ-1002",
      name: "Mobile Onboarding",
      category: "mobile",
      budgetHours: 300,
      status: "active",
      startDate: new Date("2026-02-01"),
      targetDate: new Date("2026-07-01"),
      owner: bob._id,
    }),
    Project.create({
      projectCode: "PRJ-1003",
      name: "Analytics Pipeline",
      category: "data",
      budgetHours: 520,
      status: "on-hold",
      startDate: new Date("2026-01-15"),
      targetDate: new Date("2026-09-01"),
      owner: alice._id,
    }),
    Project.create({
      projectCode: "PRJ-1004",
      name: "Design System Rollout",
      category: "web",
      budgetHours: 220,
      status: "completed",
      startDate: new Date("2025-08-01"),
      targetDate: new Date("2026-01-15"),
      owner: bob._id,
    }),
    Project.create({
      projectCode: "PRJ-1005",
      name: "Release Automation",
      category: "data",
      budgetHours: 180,
      status: "active",
      startDate: new Date("2026-03-01"),
      targetDate: new Date("2026-06-30"),
      owner: alice._id,
    }),
  ]);

  console.log("Creating tasks...");

  // Created sequentially: the Task model auto-generates taskNumber in a
  // pre("save") hook based on countDocuments(), so concurrent creates would race.
  const task1 = await Task.create({
    project: project1._id,
    title: "Implement account settings UI",
    dueDate: new Date("2026-04-10"),
    estimateHours: 28,
    status: "todo",
    assignedTo: alice._id,
  });

  const task2 = await Task.create({
    project: project2._id,
    title: "Build email verification flow",
    dueDate: new Date("2026-04-01"),
    estimateHours: 36,
    status: "in-progress",
    assignedTo: bob._id,
  });
  task2.notes.push({
    author: bob._id,
    text: "Waiting on API contract finalization from backend.",
    createdAt: new Date("2026-03-15"),
  });
  await task2.save();

  const task3 = await Task.create({
    project: project3._id,
    title: "Define warehouse schema migrations",
    dueDate: new Date("2026-05-05"),
    estimateHours: 42,
    status: "blocked",
    assignedTo: alice._id,
  });
  task3.notes.push({
    author: admin._id,
    text: "Blocked pending infrastructure budget approval.",
    createdAt: new Date("2026-03-20"),
  });
  await task3.save();

  const task4 = await Task.create({
    project: project4._id,
    title: "Publish component migration guide",
    dueDate: new Date("2026-01-05"),
    estimateHours: 14,
    status: "done",
    assignedTo: bob._id,
  });
  task4.notes.push({
    author: bob._id,
    text: "Guide shipped and shared with all product squads.",
    createdAt: new Date("2026-01-04"),
  });
  await task4.save();

  const task5 = await Task.create({
    project: project5._id,
    title: "Set up CI release tagging",
    dueDate: new Date("2026-04-20"),
    estimateHours: 20,
    status: "in-progress",
    assignedTo: alice._id,
  });
  task5.notes.push(
    {
      author: alice._id,
      text: "Initial pipeline drafted and tested in staging.",
      createdAt: new Date("2026-03-18"),
    },
    {
      author: admin._id,
      text: "Needs rollback docs before production rollout.",
      createdAt: new Date("2026-03-21"),
    },
  );
  await task5.save();

  const task6 = await Task.create({
    project: project2._id,
    title: "Finalize mobile launch checklist",
    dueDate: new Date("2026-05-15"),
    estimateHours: 16,
    status: "todo",
    assignedTo: bob._id,
  });

  const users: IUser[] = [admin, alice, bob];
  console.log(`Seeded ${users.length} users, 5 projects, 6 tasks.`);
  console.log(
    "Task numbers:",
    [task1, task2, task3, task4, task5, task6].map((task) => task.taskNumber).join(", "),
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
