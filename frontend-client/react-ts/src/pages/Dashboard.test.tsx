import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Dashboard from "./Dashboard";
import api from "../api";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("../useAuth", () => ({
  useAuth: () => ({
    user: {
      _id: "user-1",
      name: "Alice Adjuster",
      email: "alice@example.com",
      role: "member",
      createdAt: new Date("2026-01-01").toISOString(),
    },
  }),
}));

const mockedApi = vi.mocked(api);

describe("Dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps dashboard stats visible when the standup request fails", async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === "/dashboard") {
        return {
          data: {
            totalTasks: 4,
            tasksByStatus: {
              todo: 1,
              "in-progress": 2,
              blocked: 1,
              done: 0,
            },
            totalProjects: 2,
            projectsByCategory: {
              web: 1,
              mobile: 0,
              data: 1,
            },
            totalUsers: 3,
            recentTasks: [],
            totalEstimateHours: 12,
          },
        };
      }

      if (url === "/dashboard/ai-standup") {
        throw new Error("standup unavailable");
      }

      return { data: {} };
    });

    render(<Dashboard />);

    expect(await screen.findByText("Total Tasks")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /ai standup summary/i })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/something went wrong\. please try again\./i),
    ).not.toBeInTheDocument();
  });
});
