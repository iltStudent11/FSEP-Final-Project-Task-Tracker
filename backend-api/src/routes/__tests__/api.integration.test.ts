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
  });
});
