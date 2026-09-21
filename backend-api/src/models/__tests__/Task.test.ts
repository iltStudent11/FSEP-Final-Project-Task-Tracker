import { beforeAll, afterAll, afterEach, describe, expect, it } from "vitest";
import Task from "../Task";
import User from "../User";
import Project from "../Project";
import { clearTestDB, connectTestDB, disconnectTestDB } from "../../test/db";

beforeAll(async () => {
  await connectTestDB();
  await Promise.all([User.init(), Project.init(), Task.init()]);
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

async function createOwner(name = "Owner") {
  return User.create({
    name,
    email: `${name.toLowerCase()}@example.com`,
    password: "Password123!",
    role: "member",
  });
}

async function createProject(ownerId: string) {
  return Project.create({
    projectCode: "TST-1001",
    name: "Task Model Project",
    category: "web",
    budgetHours: 20,
    status: "active",
    startDate: new Date("2026-01-01"),
    targetDate: new Date("2026-02-01"),
    owner: ownerId,
  });
}

describe("Task model", () => {
  it("auto-generates sequential task numbers", async () => {
    const owner = await createOwner("OwnerA");
    const project = await createProject(owner._id.toString());

    const task1 = await Task.create({
      project: project._id,
      title: "First",
      dueDate: new Date("2026-03-01"),
    });

    const task2 = await Task.create({
      project: project._id,
      title: "Second",
      dueDate: new Date("2026-03-02"),
    });

    expect(task1.taskNumber).toBe("TSK-1000");
    expect(task2.taskNumber).toBe("TSK-1001");
  });

  it("defaults status to todo", async () => {
    const owner = await createOwner("OwnerB");
    const project = await createProject(owner._id.toString());

    const task = await Task.create({
      project: project._id,
      title: "Default status task",
      dueDate: new Date("2026-03-03"),
    });

    expect(task.status).toBe("todo");
  });

  it("persists description, assignedTo, and completedBy when provided", async () => {
    const owner = await createOwner("OwnerC");
    const completer = await createOwner("OwnerD");
    const project = await createProject(owner._id.toString());

    const task = await Task.create({
      project: project._id,
      title: "Done task",
      description: "Detailed completion context",
      dueDate: new Date("2026-03-04"),
      status: "done",
      assignedTo: owner._id,
      completedBy: completer._id,
      estimateHours: 6,
    });

    expect(task.description).toBe("Detailed completion context");
    expect(task.assignedTo?.toString()).toBe(owner._id.toString());
    expect(task.completedBy?.toString()).toBe(completer._id.toString());
    expect(task.status).toBe("done");
  });

  it("allows unassigned todo tasks", async () => {
    const owner = await createOwner("OwnerE");
    const project = await createProject(owner._id.toString());

    const task = await Task.create({
      project: project._id,
      title: "Backlog item",
      dueDate: new Date("2026-03-05"),
      status: "todo",
    });

    expect(task.assignedTo).toBeUndefined();
    expect(task.completedBy).toBeUndefined();
  });

  it("rejects negative estimateHours", async () => {
    const owner = await createOwner("OwnerF");
    const project = await createProject(owner._id.toString());

    await expect(
      Task.create({
        project: project._id,
        title: "Invalid estimate",
        dueDate: new Date("2026-03-06"),
        estimateHours: -1,
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid status values", async () => {
    const owner = await createOwner("OwnerG");
    const project = await createProject(owner._id.toString());

    await expect(
      Task.create(
        {
          project: project._id,
          title: "Invalid status",
          dueDate: new Date("2026-03-07"),
          status: "archived",
        } as any,
      ),
    ).rejects.toThrow();
  });

  it("stores task notes with author and text", async () => {
    const owner = await createOwner("OwnerH");
    const project = await createProject(owner._id.toString());

    const task = await Task.create({
      project: project._id,
      title: "Noted task",
      dueDate: new Date("2026-03-08"),
      notes: [
        {
          author: owner._id,
          text: "Initial note",
          createdAt: new Date("2026-03-01"),
        },
      ],
    });

    expect(task.notes).toHaveLength(1);
    expect(task.notes[0]?.text).toBe("Initial note");
    expect(task.notes[0]?.author.toString()).toBe(owner._id.toString());
  });

  it("stores subtasks and defaults completed to false", async () => {
    const owner = await createOwner("OwnerI");
    const project = await createProject(owner._id.toString());

    const task = await Task.create({
      project: project._id,
      title: "Task with subtasks",
      dueDate: new Date("2026-03-09"),
      subtasks: [{ text: "Write code" }, { text: "Write tests", completed: true }],
    });

    expect(task.subtasks).toHaveLength(2);
    expect(task.subtasks[0]?.text).toBe("Write code");
    expect(task.subtasks[0]?.completed).toBe(false);
    expect(task.subtasks[1]?.completed).toBe(true);
  });

  it("rejects a subtask with no text", async () => {
    const owner = await createOwner("OwnerJ");
    const project = await createProject(owner._id.toString());

    await expect(
      Task.create({
        project: project._id,
        title: "Task with invalid subtask",
        dueDate: new Date("2026-03-10"),
        subtasks: [{ completed: false } as any],
      }),
    ).rejects.toThrow();
  });
});
