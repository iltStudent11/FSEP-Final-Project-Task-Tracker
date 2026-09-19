import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Projects from "./Projects";
import api from "../api";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

function projectParam(config: unknown): string | undefined {
  if (!config || typeof config !== "object") return undefined;
  const configWithParams = config as { params?: unknown };
  if (!configWithParams.params || typeof configWithParams.params !== "object") return undefined;
  const params = configWithParams.params as { project?: unknown };
  return typeof params.project === "string" ? params.project : undefined;
}

function mockProjectLoad() {
  mockedApi.get.mockImplementation(async (url: string, config?: unknown) => {
    if (url === "/projects") {
      return {
        data: {
          projects: [
            {
              _id: "proj-1",
              projectCode: "LAB-2",
              name: "1.2 Planning & Landing Page",
              category: "web",
              budgetHours: 100,
              status: "active",
              startDate: new Date("2026-09-02").toISOString(),
              targetDate: new Date("2026-12-12").toISOString(),
              owner: "u-admin",
              createdAt: new Date("2026-09-01").toISOString(),
            },
          ],
          pagination: { page: 1, limit: 10, total: 1, pages: 1 },
        },
      };
    }

    if (url === "/tasks" && projectParam(config) === "proj-1") {
      return {
        data: {
          tasks: [
            {
              _id: "task-1",
              taskNumber: "TSK-1005",
              project: "proj-1",
              title: "1.2.3. GitHub Actions CI Pipeline",
              dueDate: new Date("2026-10-07").toISOString(),
              estimateHours: 8,
              status: "in-progress",
              assignedTo: "u-alice",
              notes: [],
              createdAt: new Date("2026-09-01").toISOString(),
              updatedAt: new Date("2026-09-01").toISOString(),
            },
          ],
          pagination: { page: 1, limit: 100, total: 1, pages: 1 },
        },
      };
    }

    return { data: {} };
  });
}

function renderProjects() {
  return render(
    <MemoryRouter>
      <Projects />
    </MemoryRouter>,
  );
}

describe("Projects page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectLoad();
  });

  it("renders project list", async () => {
    renderProjects();

    expect(await screen.findByText("LAB-2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1\.2 planning & landing page/i })).toBeInTheDocument();
  });

  it("expands project details and loads associated tasks", async () => {
    const user = userEvent.setup();
    renderProjects();

    const projectButton = await screen.findByRole("button", { name: /1\.2 planning & landing page/i });
    await user.click(projectButton);

    expect(await screen.findByText(/associated tasks \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("TSK-1005")).toBeInTheDocument();
    expect(screen.getByText(/1\.2\.3\. github actions ci pipeline/i)).toBeInTheDocument();
  });

  it("renders associated task titles as links to tasks page", async () => {
    const user = userEvent.setup();
    renderProjects();

    const projectButton = await screen.findByRole("button", { name: /1\.2 planning & landing page/i });
    await user.click(projectButton);

    const taskLink = await screen.findByRole("link", { name: /1\.2\.3\. github actions ci pipeline/i });
    expect(taskLink).toHaveAttribute("href", "/tasks?search=TSK-1005");
  });

  it("shows empty-state message when project has no tasks", async () => {
    mockedApi.get.mockImplementation(async (url: string, config?: unknown) => {
      if (url === "/projects") {
        return {
          data: {
            projects: [
              {
                _id: "proj-1",
                projectCode: "LAB-2",
                name: "1.2 Planning & Landing Page",
                category: "web",
                budgetHours: 100,
                status: "active",
                startDate: new Date("2026-09-02").toISOString(),
                targetDate: new Date("2026-12-12").toISOString(),
                owner: "u-admin",
                createdAt: new Date("2026-09-01").toISOString(),
              },
            ],
            pagination: { page: 1, limit: 10, total: 1, pages: 1 },
          },
        };
      }

      if (url === "/tasks" && projectParam(config) === "proj-1") {
        return {
          data: { tasks: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
        };
      }

      return { data: {} };
    });

    const user = userEvent.setup();
    renderProjects();

    const projectButton = await screen.findByRole("button", { name: /1\.2 planning & landing page/i });
    await user.click(projectButton);

    expect(await screen.findByText(/no tasks found for this project/i)).toBeInTheDocument();
  });

  it("shows task-load errors in expanded panel", async () => {
    mockedApi.get.mockImplementation(async (url: string, config?: unknown) => {
      if (url === "/projects") {
        return {
          data: {
            projects: [
              {
                _id: "proj-1",
                projectCode: "LAB-2",
                name: "1.2 Planning & Landing Page",
                category: "web",
                budgetHours: 100,
                status: "active",
                startDate: new Date("2026-09-02").toISOString(),
                targetDate: new Date("2026-12-12").toISOString(),
                owner: "u-admin",
                createdAt: new Date("2026-09-01").toISOString(),
              },
            ],
            pagination: { page: 1, limit: 10, total: 1, pages: 1 },
          },
        };
      }

      if (url === "/tasks" && projectParam(config) === "proj-1") {
        throw { response: { data: { message: "Unable to load tasks for project" } } };
      }

      return { data: {} };
    });

    const user = userEvent.setup();
    renderProjects();

    const projectButton = await screen.findByRole("button", { name: /1\.2 planning & landing page/i });
    await user.click(projectButton);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong\. please try again\./i)).toBeInTheDocument();
    });
  });
});
