import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Tasks from "./Tasks";
import type { Task, User } from "../types";
import api from "../api";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

const users: User[] = [
  {
    _id: "u-admin",
    name: "Admin User",
    email: "admin@tasktracker.com",
    role: "admin",
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    _id: "u-alice",
    name: "Alice Adjuster",
    email: "alice@tasktracker.com",
    role: "member",
    createdAt: new Date("2026-01-02").toISOString(),
  },
];

const baseTask: Task = {
  _id: "task-1",
  taskNumber: "TSK-1001",
  project: "proj-1",
  title: "1.2.3. GitHub Actions CI Pipeline",
  dueDate: new Date("2026-10-07").toISOString(),
  estimateHours: 6,
  status: "in-progress",
  assignedTo: "u-alice",
  completedBy: undefined,
  notes: [],
  subtasks: [
    { _id: "sub-1", text: "Check out the code", completed: false },
    { _id: "sub-2", text: "Install dependencies", completed: true },
  ],
  createdAt: new Date("2026-09-01").toISOString(),
  updatedAt: new Date("2026-09-01").toISOString(),
};

function mockInitialLoad(tasks: Task[] = [baseTask]) {
  mockedApi.get.mockImplementation(async (url: string) => {
    if (url === "/projects") {
      return {
        data: {
          projects: [
            {
              _id: "proj-1",
              projectCode: "LAB-2",
              name: "Planning",
              category: "web",
              budgetHours: 10,
              status: "active",
              startDate: new Date("2026-09-01").toISOString(),
              targetDate: new Date("2026-12-01").toISOString(),
              owner: "u-admin",
              createdAt: new Date("2026-09-01").toISOString(),
            },
          ],
        },
      };
    }

    if (url === "/auth/users") {
      return { data: { users } };
    }

    if (url === "/tasks") {
      return {
        data: {
          tasks,
          pagination: { page: 1, limit: 10, total: tasks.length, pages: 1 },
        },
      };
    }

    return { data: {} };
  });
}

function renderTasks(initialEntries: string[] = ["/tasks"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Tasks />
    </MemoryRouter>,
  );
}

describe("Tasks page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitialLoad();
    mockedApi.put.mockResolvedValue({ data: { task: baseTask } });
    mockedApi.post.mockResolvedValue({ data: { task: baseTask } });
    mockedApi.patch.mockResolvedValue({ data: { task: baseTask } });
  });

  it("renders assignment columns", async () => {
    renderTasks();

    await screen.findByText("TSK-1001");

    expect(screen.getByRole("columnheader", { name: /assigned to/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /completed by/i })).toBeInTheDocument();
  });

  it("expands task details when title is clicked", async () => {
    const user = userEvent.setup();
    renderTasks();

    await screen.findByText("TSK-1001");
    await user.click(screen.getByRole("button", { name: /1\.2\.3\. github actions ci pipeline/i }));

    expect(await screen.findByText(/task details/i)).toBeInTheDocument();
    expect(screen.getByText("Check out the code")).toBeInTheDocument();
    expect(screen.getByText("Install dependencies")).toBeInTheDocument();
  });

  it("toggles a subtask's completed state via checkbox", async () => {
    const user = userEvent.setup();
    renderTasks();

    await screen.findByText("TSK-1001");
    await user.click(screen.getByRole("button", { name: /1\.2\.3\. github actions ci pipeline/i }));
    await screen.findByText(/task details/i);

    const checkbox = screen.getByLabelText("Check out the code");
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith("/tasks/task-1/subtasks/sub-1", {
        completed: true,
      });
    });
  });

  it("shows a completed subtask as checked", async () => {
    const user = userEvent.setup();
    renderTasks();

    await screen.findByText("TSK-1001");
    await user.click(screen.getByRole("button", { name: /1\.2\.3\. github actions ci pipeline/i }));
    await screen.findByText(/task details/i);

    expect(screen.getByLabelText("Install dependencies")).toBeChecked();
  });

  it("adds a new subtask via the subtask form", async () => {
    const user = userEvent.setup();
    renderTasks();

    await screen.findByText("TSK-1001");
    await user.click(screen.getByRole("button", { name: /1\.2\.3\. github actions ci pipeline/i }));
    await screen.findByText(/task details/i);

    const input = screen.getByLabelText(/add a subtask to task tsk-1001/i);
    await user.type(input, "Write docs");
    await user.click(screen.getByRole("button", { name: /add subtask/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/tasks/task-1/subtasks", {
        text: "Write docs",
      });
    });
  });

  it("updates assignedTo from dropdown", async () => {
    const user = userEvent.setup();
    renderTasks();

    const select = await screen.findByLabelText(/assign user for task tsk-1001/i);
    await user.selectOptions(select, "u-admin");

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/tasks/task-1", { assignedTo: "u-admin" });
    });
  });

  it("updates completedBy from dropdown", async () => {
    const user = userEvent.setup();
    renderTasks();

    const select = await screen.findByLabelText(/completed by user for task tsk-1001/i);
    await user.selectOptions(select, "u-admin");

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/tasks/task-1", { completedBy: "u-admin" });
    });
  });

  it("updates status from dropdown", async () => {
    const user = userEvent.setup();
    renderTasks();

    const select = await screen.findByLabelText(/status for task tsk-1001/i);
    await user.selectOptions(select, "done");

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/tasks/task-1", { status: "done" });
    });
  });

  it("updates estimate hours on blur when changed", async () => {
    const user = userEvent.setup();
    renderTasks();

    const input = await screen.findByLabelText(/estimate hours for task tsk-1001/i);
    await user.clear(input);
    await user.type(input, "8");
    await user.tab();

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/tasks/task-1", { estimateHours: 8 });
    });
  });

  it("does not call the API when estimate hours is blurred unchanged", async () => {
    const user = userEvent.setup();
    renderTasks();

    const input = await screen.findByLabelText(/estimate hours for task tsk-1001/i);
    await user.click(input);
    await user.tab();

    expect(mockedApi.put).not.toHaveBeenCalled();
  });

  it("rejects a negative estimate hours value without calling the API", async () => {
    const user = userEvent.setup();
    renderTasks();

    const input = await screen.findByLabelText(/estimate hours for task tsk-1001/i);
    await user.clear(input);
    await user.type(input, "-1");
    await user.tab();

    expect(await screen.findByText(/estimate hours must be a non-negative number/i)).toBeInTheDocument();
    expect(mockedApi.put).not.toHaveBeenCalled();
  });

  it("updates due date when changed", async () => {
    renderTasks();

    const input = await screen.findByLabelText(/due date for task tsk-1001/i);
    fireEvent.change(input, { target: { value: "2026-11-15" } });

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith("/tasks/task-1", { dueDate: "2026-11-15" });
    });
  });

  it("shows API error when status update fails", async () => {
    mockedApi.put.mockRejectedValueOnce({
      response: { data: { message: "Both assignedTo and completedBy are required when status is done" } },
    });

    const user = userEvent.setup();
    renderTasks();

    const select = await screen.findByLabelText(/status for task tsk-1001/i);
    await user.selectOptions(select, "done");

    expect(await screen.findByText(/something went wrong\. please try again\./i)).toBeInTheDocument();
  });

  it("locks assignment dropdowns when task status is done", async () => {
    mockInitialLoad([
      {
        ...baseTask,
        _id: "task-done",
        taskNumber: "TSK-2000",
        status: "done",
        completedBy: "u-admin",
      },
    ]);

    renderTasks();

    const assignedToSelect = await screen.findByLabelText(/assign user for task tsk-2000/i);
    const completedBySelect = await screen.findByLabelText(/completed by user for task tsk-2000/i);

    expect(assignedToSelect).toBeDisabled();
    expect(completedBySelect).toBeDisabled();
  });

  it("auto-expands focused task when navigated with focusTaskId state", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/tasks",
            search: "?search=TSK-1001",
            state: { focusTaskId: "task-1" },
          },
        ]}
      >
        <Tasks />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/task details/i)).toBeInTheDocument();
    });
  });

  it("generates AI subtasks and includes them when creating a task", async () => {
    const user = userEvent.setup();

    mockedApi.post.mockResolvedValueOnce({
      data: {
        subtasks: [
          "Clarify acceptance criteria and edge cases",
          "Implement endpoint/service logic",
        ],
      },
    });
    mockedApi.post.mockResolvedValueOnce({ data: { task: baseTask } });

    renderTasks();

    await user.click(await screen.findByRole("button", { name: /new task/i }));

    await user.selectOptions(screen.getByLabelText(/project/i), "proj-1");
    await user.type(screen.getByLabelText(/task title/i), "Build login API");
    await user.type(screen.getByLabelText("Due Date"), "2026-12-01");

    await user.click(screen.getByRole("button", { name: /ai suggest subtasks/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/tasks/ai-suggest-subtasks", {
        title: "Build login API",
      });
    });

    await user.click(screen.getByRole("button", { name: /create task/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/tasks", {
        project: "proj-1",
        title: "Build login API",
        dueDate: "2026-12-01",
        estimateHours: undefined,
        subtasks: [
          "Clarify acceptance criteria and edge cases",
          "Implement endpoint/service logic",
        ],
      });
    });
  });
});
