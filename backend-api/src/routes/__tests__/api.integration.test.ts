import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import User from "../../models/User";
import { createApp } from "../../app";
import { clearTestDB, connectTestDB, disconnectTestDB } from "../../test/db";

const app = createApp();

const validProjectPayload = {
  projectCode: "PRJ-100",
  name: "Integration Project",
  category: "web",
  budgetHours: 120,
  status: "active",
  startDate: "2026-09-01",
  targetDate: "2026-12-31",
};

async function createAuthenticatedUser(email = "admin@test.com") {
  const registerRes = await request(app).post("/api/auth/register").send({
    name: "Admin User",
    email,
    password: "Admin123!",
    role: "admin",
  });

  expect(registerRes.status).toBe(201);

  const loginRes = await request(app).post("/api/auth/login").send({
    email,
    password: "Admin123!",
  });

  expect(loginRes.status).toBe(200);

  return {
    token: loginRes.body.token as string,
    userId: loginRes.body.user._id as string,
  };
}

describe("API integration", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";
    await connectTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  describe("auth routes", () => {
    it("registers a user and omits password in response", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "Password123!",
      });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe("jane@example.com");
      expect(response.body.user.password).toBeUndefined();
    });

    it("prevents duplicate registration", async () => {
      await request(app).post("/api/auth/register").send({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "Password123!",
      });

      const secondAttempt = await request(app).post("/api/auth/register").send({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "Password123!",
      });

      expect(secondAttempt.status).toBe(409);
      expect(secondAttempt.body.message).toBe("Email is already registered");
    });

    it("returns current user from /me when authenticated", async () => {
      const { token } = await createAuthenticatedUser("me@example.com");

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe("me@example.com");
    });

    it("returns users list for authenticated requests", async () => {
      const { token } = await createAuthenticatedUser("users@example.com");
      await User.create({
        name: "Member User",
        email: "member@example.com",
        password: "Password123!",
        role: "member",
      });

      const response = await request(app)
        .get("/api/auth/users")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(2);
      expect(response.body.users.map((user: { email: string }) => user.email)).toEqual(
        expect.arrayContaining(["users@example.com", "member@example.com"]),
      );
    });

    it("rejects /users without token", async () => {
      const response = await request(app).get("/api/auth/users");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Missing or malformed authorization header");
    });

    it("allows admin to update user profile fields including role", async () => {
      const { token } = await createAuthenticatedUser("admin-update@example.com");
      const member = await User.create({
        name: "Member User",
        email: "member-update@example.com",
        password: "Password123!",
        role: "member",
      });

      const response = await request(app)
        .put(`/api/auth/users/${member._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Updated Member",
          email: "updated-member@example.com",
          role: "lead",
          password: "UpdatedPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body.user.name).toBe("Updated Member");
      expect(response.body.user.email).toBe("updated-member@example.com");
      expect(response.body.user.role).toBe("lead");
      expect(response.body.user.password).toBeUndefined();

      const logsRes = await request(app)
        .get("/api/audit?eventType=action")
        .set("Authorization", "Bearer " + token);

      expect(logsRes.status).toBe(200);
      expect(
        logsRes.body.logs.find(
          (log: {
            action: string;
            targetId?: string;
            details?: { body?: { password?: string } };
          }) =>
            log.action === `PUT /api/auth/users/${member._id}` &&
            log.targetId === member._id.toString() &&
            log.details?.body?.password === "[REDACTED]",
        ),
      ).toBeDefined();
    });

    it("allows admin to delete a user", async () => {
      const { token } = await createAuthenticatedUser("admin-delete@example.com");
      const member = await User.create({
        name: "Member Delete",
        email: "member-delete@example.com",
        password: "Password123!",
        role: "member",
      });

      const response = await request(app)
        .delete(`/api/auth/users/${member._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(204);

      const deletedUser = await User.findById(member._id);
      expect(deletedUser).toBeNull();
    });

    it("rejects member role from updating users", async () => {
      await request(app).post("/api/auth/register").send({
        name: "Member",
        email: "member-admin-guard@example.com",
        password: "Password123!",
        role: "member",
      });
      const loginRes = await request(app).post("/api/auth/login").send({
        email: "member-admin-guard@example.com",
        password: "Password123!",
      });
      const memberToken = loginRes.body.token as string;

      const target = await User.create({
        name: "Target User",
        email: "target-update@example.com",
        password: "Password123!",
        role: "member",
      });

      const response = await request(app)
        .put(`/api/auth/users/${target._id}`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ role: "lead" });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Forbidden: insufficient permissions");
    });

    it("rejects member role from deleting users", async () => {
      await request(app).post("/api/auth/register").send({
        name: "Member Two",
        email: "member-delete-guard@example.com",
        password: "Password123!",
        role: "member",
      });
      const loginRes = await request(app).post("/api/auth/login").send({
        email: "member-delete-guard@example.com",
        password: "Password123!",
      });
      const memberToken = loginRes.body.token as string;

      const target = await User.create({
        name: "Target Delete",
        email: "target-delete@example.com",
        password: "Password123!",
        role: "member",
      });

      const response = await request(app)
        .delete(`/api/auth/users/${target._id}`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Forbidden: insufficient permissions");
    });

    it("records login and logout in audit logs visible to admins", async () => {
      const registerRes = await request(app).post("/api/auth/register").send({
        name: "Audit Admin",
        email: "audit-admin@example.com",
        password: "Password123!",
        role: "admin",
      });
      expect(registerRes.status).toBe(201);

      const loginRes = await request(app).post("/api/auth/login").send({
        email: "audit-admin@example.com",
        password: "Password123!",
      });
      expect(loginRes.status).toBe(200);

      const token = loginRes.body.token as string;

      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`);
      expect(logoutRes.status).toBe(200);

      const logsRes = await request(app)
        .get("/api/audit?eventType=auth")
        .set("Authorization", `Bearer ${token}`);

      expect(logsRes.status).toBe(200);
      const actions = logsRes.body.logs.map((log: { action: string }) => log.action);
      expect(actions).toEqual(expect.arrayContaining(["User login", "User logout"]));
    });

    it("records tab visits and restricts audit log list to admins", async () => {
      const { token: adminToken } = await createAuthenticatedUser("audit-admin-list@example.com");

      await request(app).post("/api/auth/register").send({
        name: "Member Audit",
        email: "member-audit@example.com",
        password: "Password123!",
        role: "member",
      });
      const memberLogin = await request(app).post("/api/auth/login").send({
        email: "member-audit@example.com",
        password: "Password123!",
      });
      const memberToken = memberLogin.body.token as string;

      const eventRes = await request(app)
        .post("/api/audit/events")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ tab: "Projects", path: "/projects" });
      expect(eventRes.status).toBe(201);

      const adminLogsRes = await request(app)
        .get("/api/audit?eventType=navigation")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(adminLogsRes.status).toBe(200);
      expect(
        adminLogsRes.body.logs.some(
          (log: { action: string; details?: { tab?: string } }) =>
            log.action === "Visited tab: Projects" && log.details?.tab === "Projects",
        ),
      ).toBe(true);

      const memberLogsRes = await request(app)
        .get("/api/audit")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(memberLogsRes.status).toBe(403);
      expect(memberLogsRes.body.message).toBe("Forbidden: insufficient permissions");
    });
  });

  describe("projects routes", () => {
    it("creates and fetches a project when authenticated", async () => {
      const { token, userId } = await createAuthenticatedUser("project-owner@example.com");

      const createRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send(validProjectPayload);

      expect(createRes.status).toBe(201);
      expect(createRes.body.project.projectCode).toBe("PRJ-100");
      expect(createRes.body.project.owner).toBe(userId);

      const projectId = createRes.body.project._id;
      const getRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.project.name).toBe("Integration Project");
    });

    it("supports project search and pagination metadata", async () => {
      const { token } = await createAuthenticatedUser("project-list@example.com");

      await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...validProjectPayload, projectCode: "PRJ-101", name: "Alpha Web" });

      await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...validProjectPayload, projectCode: "PRJ-102", name: "Beta Data", category: "data" });

      const response = await request(app)
        .get("/api/projects?search=Alpha&page=1&limit=1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].name).toBe("Alpha Web");
      expect(response.body.pagination).toMatchObject({ page: 1, limit: 1, total: 1, pages: 1 });
    });

    it("rejects unauthenticated project creation", async () => {
      const response = await request(app).post("/api/projects").send(validProjectPayload);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Missing or malformed authorization header");
    });
  });

  describe("tasks routes", () => {
    async function setupTaskContext() {
      const { token, userId } = await createAuthenticatedUser("tasks-owner@example.com");
      const teammate = await User.create({
        name: "Teammate",
        email: "teammate@example.com",
        password: "Password123!",
      });

      const projectRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...validProjectPayload, projectCode: "PRJ-200" });

      expect(projectRes.status).toBe(201);

      return {
        token,
        ownerId: userId,
        teammateId: teammate._id.toString(),
        projectId: projectRes.body.project._id as string,
      };
    }

    it("enforces assignedTo and completedBy when creating done tasks", async () => {
      const { token, projectId } = await setupTaskContext();

      const response = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Close ticket",
          dueDate: "2026-10-01",
          status: "done",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Both assignedTo and completedBy are required when status is done",
      );
    });

    it("creates done task when both assignment fields are provided", async () => {
      const { token, projectId, ownerId, teammateId } = await setupTaskContext();

      const response = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Deploy release",
          dueDate: "2026-10-05",
          status: "done",
          assignedTo: ownerId,
          completedBy: teammateId,
        });

      expect(response.status).toBe(201);
      expect(response.body.task.status).toBe("done");
      expect(response.body.task.assignedTo).toBe(ownerId);
      expect(response.body.task.completedBy).toBe(teammateId);
    });

    it("locks assignedTo and completedBy updates once task is done", async () => {
      const { token, projectId, ownerId, teammateId } = await setupTaskContext();

      const createRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Finish docs",
          dueDate: "2026-10-10",
          status: "done",
          assignedTo: ownerId,
          completedBy: teammateId,
        });

      expect(createRes.status).toBe(201);

      const secondUser = await User.create({
        name: "Second User",
        email: "second@example.com",
        password: "Password123!",
      });

      const updateRes = await request(app)
        .put(`/api/tasks/${createRes.body.task._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ assignedTo: secondUser._id.toString() });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.message).toBe(
        "assignedTo and completedBy are locked once a task is marked done",
      );
    });

    it("enforces done rule on task status updates", async () => {
      const { token, projectId } = await setupTaskContext();

      const createRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Review PR",
          dueDate: "2026-10-12",
          status: "todo",
        });

      expect(createRes.status).toBe(201);

      const updateRes = await request(app)
        .put(`/api/tasks/${createRes.body.task._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "done" });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.message).toBe(
        "Both assignedTo and completedBy are required when status is done",
      );
    });

    it("returns filtered task lists by completedBy", async () => {
      const { token, projectId, ownerId, teammateId } = await setupTaskContext();

      await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Task A",
          dueDate: "2026-10-13",
          status: "done",
          assignedTo: ownerId,
          completedBy: teammateId,
        });

      await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Task B",
          dueDate: "2026-10-14",
          status: "done",
          assignedTo: ownerId,
          completedBy: ownerId,
        });

      const response = await request(app)
        .get(`/api/tasks?completedBy=${teammateId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0].title).toBe("Task A");
    });

    it("adds notes to a task with authenticated user as note author", async () => {
      const { token, projectId, ownerId } = await setupTaskContext();

      const taskRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Write runbook",
          dueDate: "2026-10-20",
          status: "todo",
        });

      expect(taskRes.status).toBe(201);

      const noteRes = await request(app)
        .post(`/api/tasks/${taskRes.body.task._id}/notes`)
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Initial implementation complete." });

      expect(noteRes.status).toBe(201);
      expect(noteRes.body.task.notes).toHaveLength(1);
      expect(noteRes.body.task.notes[0].text).toBe("Initial implementation complete.");
      expect(noteRes.body.task.notes[0].author).toBe(ownerId);
    });

    it("creates a task with subtasks, all initially incomplete", async () => {
      const { token, projectId } = await setupTaskContext();

      const response = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Ship feature",
          dueDate: "2026-10-21",
          subtasks: ["Write code", "Write tests", "Update docs"],
        });

      expect(response.status).toBe(201);
      expect(response.body.task.subtasks).toHaveLength(3);
      expect(response.body.task.subtasks.map((s: { text: string }) => s.text)).toEqual([
        "Write code",
        "Write tests",
        "Update docs",
      ]);
      expect(response.body.task.subtasks.every((s: { completed: boolean }) => !s.completed)).toBe(
        true,
      );
      expect(response.body.task.status).toBe("todo");
    });

    it("adds a subtask to an existing task, incomplete by default", async () => {
      const { token, projectId } = await setupTaskContext();

      const taskRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Ship feature",
          dueDate: "2026-10-26",
        });

      const subtaskRes = await request(app)
        .post(`/api/tasks/${taskRes.body.task._id}/subtasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Write code" });

      expect(subtaskRes.status).toBe(201);
      expect(subtaskRes.body.task.subtasks).toHaveLength(1);
      expect(subtaskRes.body.task.subtasks[0].text).toBe("Write code");
      expect(subtaskRes.body.task.subtasks[0].completed).toBe(false);
    });

    it("rejects adding a subtask with empty text", async () => {
      const { token, projectId } = await setupTaskContext();

      const taskRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Ship feature",
          dueDate: "2026-10-27",
        });

      const subtaskRes = await request(app)
        .post(`/api/tasks/${taskRes.body.task._id}/subtasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "   " });

      expect(subtaskRes.status).toBe(400);
    });

    it("reopens a done task when a new subtask is added", async () => {
      const { token, ownerId, projectId } = await setupTaskContext();

      const taskRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Ship feature",
          dueDate: "2026-10-28",
          subtasks: ["Only step"],
        });

      const [subtask] = taskRes.body.task.subtasks as { _id: string }[];

      const completeRes = await request(app)
        .patch(`/api/tasks/${taskRes.body.task._id}/subtasks/${subtask!._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ completed: true });

      expect(completeRes.body.task.status).toBe("done");
      expect(completeRes.body.task.assignedTo).toBe(ownerId);

      const newSubtaskRes = await request(app)
        .post(`/api/tasks/${taskRes.body.task._id}/subtasks`)
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "One more thing" });

      expect(newSubtaskRes.status).toBe(201);
      expect(newSubtaskRes.body.task.status).toBe("in-progress");
      expect(newSubtaskRes.body.task.subtasks).toHaveLength(2);
    });

    it("marks a task done and auto-assigns the current user once every subtask is completed", async () => {
      const { token, ownerId, projectId } = await setupTaskContext();

      const taskRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Ship feature",
          dueDate: "2026-10-22",
          subtasks: ["Write code", "Write tests"],
        });

      expect(taskRes.status).toBe(201);
      const [first, second] = taskRes.body.task.subtasks as { _id: string }[];

      const firstToggle = await request(app)
        .patch(`/api/tasks/${taskRes.body.task._id}/subtasks/${first!._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ completed: true });

      expect(firstToggle.status).toBe(200);
      expect(firstToggle.body.task.status).toBe("todo");

      const secondToggle = await request(app)
        .patch(`/api/tasks/${taskRes.body.task._id}/subtasks/${second!._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ completed: true });

      expect(secondToggle.status).toBe(200);
      expect(secondToggle.body.task.status).toBe("done");
      expect(secondToggle.body.task.assignedTo).toBe(ownerId);
      expect(secondToggle.body.task.completedBy).toBe(ownerId);
    });

    it("moves a done task back to in-progress when a subtask is un-completed", async () => {
      const { token, projectId } = await setupTaskContext();

      const taskRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Ship feature",
          dueDate: "2026-10-23",
          subtasks: ["Only step"],
        });

      const [subtask] = taskRes.body.task.subtasks as { _id: string }[];

      const completeRes = await request(app)
        .patch(`/api/tasks/${taskRes.body.task._id}/subtasks/${subtask!._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ completed: true });

      expect(completeRes.body.task.status).toBe("done");

      const reopenRes = await request(app)
        .patch(`/api/tasks/${taskRes.body.task._id}/subtasks/${subtask!._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ completed: false });

      expect(reopenRes.status).toBe(200);
      expect(reopenRes.body.task.status).toBe("in-progress");
    });

    it("rejects marking a task done manually while subtasks are incomplete", async () => {
      const { token, projectId } = await setupTaskContext();

      const taskRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Ship feature",
          dueDate: "2026-10-24",
          subtasks: ["Write code", "Write tests"],
        });

      const updateRes = await request(app)
        .put(`/api/tasks/${taskRes.body.task._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "done" });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.message).toBe(
        "All subtasks must be completed before marking this task done",
      );
    });

    it("returns 404 for an unknown subtask id", async () => {
      const { token, projectId } = await setupTaskContext();

      const taskRes = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Ship feature",
          dueDate: "2026-10-25",
          subtasks: ["Only step"],
        });

      const response = await request(app)
        .patch(`/api/tasks/${taskRes.body.task._id}/subtasks/507f1f77bcf86cd799439011`)
        .set("Authorization", `Bearer ${token}`)
        .send({ completed: true });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Subtask not found");
    });

    it("returns AI subtask suggestions from a task title", async () => {
      const { token } = await setupTaskContext();

      const response = await request(app)
        .post("/api/tasks/ai-suggest-subtasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Build login API",
          description: "Add validation and auth checks",
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.subtasks)).toBe(true);
      expect(response.body.subtasks.length).toBeGreaterThanOrEqual(3);
      expect(response.body.subtasks.join(" ").toLowerCase()).toContain("auth");
    });

    it("rejects AI subtask suggestions when unauthenticated", async () => {
      const response = await request(app)
        .post("/api/tasks/ai-suggest-subtasks")
        .send({ title: "Build login API" });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Missing or malformed authorization header");
    });
  });

  describe("dashboard routes", () => {
    async function setupDashboardContext() {
      const { token, userId } = await createAuthenticatedUser("dashboard-owner@example.com");

      const projectRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...validProjectPayload, projectCode: "PRJ-300", name: "Dashboard Project" });

      expect(projectRes.status).toBe(201);

      return {
        token,
        userId,
        projectId: projectRes.body.project._id as string,
      };
    }

    it("returns an AI standup summary", async () => {
      const { token, userId, projectId } = await setupDashboardContext();

      await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Completed setup",
          dueDate: "2026-10-01",
          status: "done",
          assignedTo: userId,
          completedBy: userId,
        });

      await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Active task",
          dueDate: "2026-10-02",
          status: "in-progress",
        });

      await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project: projectId,
          title: "Blocked task",
          dueDate: "2026-09-01",
          status: "blocked",
        });

      const response = await request(app)
        .get("/api/dashboard/ai-standup")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        riskLevel: expect.stringMatching(/low|medium|high/),
      });
      expect(Array.isArray(response.body.yesterday)).toBe(true);
      expect(Array.isArray(response.body.today)).toBe(true);
      expect(Array.isArray(response.body.blockers)).toBe(true);
      expect(response.body.yesterday.length).toBeGreaterThan(0);
      expect(response.body.today.length).toBeGreaterThan(0);
      expect(response.body.blockers.length).toBeGreaterThan(0);
      expect(response.body.yesterday).toEqual(expect.arrayContaining([expect.stringContaining("PRJ-300")]));
      expect(response.body.today).toEqual(expect.arrayContaining([expect.stringContaining("PRJ-300")]));
      expect(response.body.blockers).toEqual(expect.arrayContaining([expect.stringContaining("PRJ-300")]));
    });

    it("rejects standup summary when unauthenticated", async () => {
      const response = await request(app).get("/api/dashboard/ai-standup");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Missing or malformed authorization header");
    });
  });
});
