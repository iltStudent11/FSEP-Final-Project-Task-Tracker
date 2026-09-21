import swaggerJSDoc from "swagger-jsdoc";
import path from "node:path";

const definition: swaggerJSDoc.OAS3Definition = {
  openapi: "3.0.3",
  info: {
    title: "FSEP Task Tracker API",
    version: "1.0.0",
    description:
      "Project/task management API — projects, tasks, users, and a dashboard summary, secured with JWT bearer auth. Use **Authorize** below with a token from `POST /api/auth/login` to try requests live.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          _id: { type: "string", example: "6710f1a2b3c4d5e6f7081234" },
          name: { type: "string", example: "Alice Adjuster" },
          email: { type: "string", format: "email", example: "alice@tasktracker.com" },
          role: { type: "string", enum: ["adjuster", "admin"], example: "adjuster" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Project: {
        type: "object",
        properties: {
          _id: { type: "string" },
          projectCode: { type: "string", example: "PRJ-100" },
          name: { type: "string", example: "Customer Portal Revamp" },
          category: { type: "string", enum: ["web", "mobile", "data"] },
          budgetHours: { type: "number", example: 120 },
          status: { type: "string", enum: ["active", "on-hold", "completed"] },
          startDate: { type: "string", format: "date" },
          targetDate: { type: "string", format: "date" },
          owner: {
            oneOf: [{ type: "string" }, { $ref: "#/components/schemas/User" }],
            description: "A user id on list/create/update responses; a populated User on GET /projects/:id.",
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      TaskNote: {
        type: "object",
        properties: {
          author: {
            oneOf: [{ type: "string" }, { $ref: "#/components/schemas/User" }],
          },
          text: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Task: {
        type: "object",
        properties: {
          _id: { type: "string" },
          taskNumber: { type: "string", example: "TSK-1000" },
          project: {
            oneOf: [{ type: "string" }, { $ref: "#/components/schemas/Project" }],
            description: "A project id on list responses; a populated Project on GET /tasks/:id.",
          },
          title: { type: "string" },
          description: { type: "string" },
          dueDate: { type: "string", format: "date" },
          estimateHours: { type: "number" },
          status: { type: "string", enum: ["todo", "in-progress", "blocked", "done"] },
          assignedTo: {
            oneOf: [{ type: "string" }, { $ref: "#/components/schemas/User" }],
          },
          completedBy: {
            oneOf: [{ type: "string" }, { $ref: "#/components/schemas/User" }],
          },
          notes: { type: "array", items: { $ref: "#/components/schemas/TaskNote" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 10 },
          total: { type: "integer", example: 42 },
          pages: { type: "integer", example: 5 },
        },
      },
      ApiError: {
        type: "object",
        properties: {
          message: { type: "string" },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                msg: { type: "string" },
                path: { type: "string" },
                location: { type: "string" },
              },
            },
          },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing, malformed, or expired bearer token",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      },
      NotFound: {
        description: "Resource not found",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      },
      ValidationError: {
        description: "Request failed validation",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

export const swaggerSpec = swaggerJSDoc({
  definition,
  apis: [
    path.join(__dirname, "routes/*.ts"),
    path.join(__dirname, "routes/*.js"),
    path.join(__dirname, "app.ts"),
    path.join(__dirname, "app.js"),
  ],
});
