import { Fragment, useEffect, useState, type SubmitEvent } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { getErrorMessage } from "../errorMessage";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "../claimStatus";
import type { PaginatedTasks, Project, Task, TaskStatus, User, UsersResponse } from "../types";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function projectLabel(project: Task["project"], projectsById: Map<string, Project>): string {
  if (typeof project !== "string") return project.projectCode;
  return projectsById.get(project)?.projectCode ?? project;
}

export default function Tasks() {
  const [searchParams] = useSearchParams();
  const searchFromUrl = searchParams.get("search") ?? "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState<PaginatedTasks["pagination"] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<TaskStatus | "">("");
  const [search, setSearch] = useState(searchFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);
  const [page, setPage] = useState(1);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [autoExpandDisabled, setAutoExpandDisabled] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [updatingTaskField, setUpdatingTaskField] = useState<string | null>(null);

  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [formProject, setFormProject] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formEstimateHours, setFormEstimateHours] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    api
      .get<{ projects: Project[] }>("/projects", { params: { limit: 100 } })
      .then((response) => setProjects(response.data.projects))
      .catch(() => {
      });

    api
      .get<UsersResponse>("/auth/users")
      .then((response) => setUsers(response.data.users))
      .catch(() => {
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get<PaginatedTasks>("/tasks", {
          params: {
            status: status || undefined,
            search: debouncedSearch || undefined,
            page,
            limit: 10,
          },
        });
        if (!cancelled) {
          setTasks(response.data.tasks);
          setPagination(response.data.pagination);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTasks();

    return () => {
      cancelled = true;
    };
  }, [status, debouncedSearch, page, refreshIndex]);

  const projectsById = new Map<string, Project>(projects.map((project) => [project._id, project]));

  const autoExpandedTaskId =
    !autoExpandDisabled && searchFromUrl
      ? tasks.find((task) => task.taskNumber.toLowerCase() === searchFromUrl.toLowerCase())?._id ?? null
      : null;

  const effectiveExpandedTaskId = expandedTaskId ?? autoExpandedTaskId;

  function userId(value: Task["assignedTo"] | Task["completedBy"]): string {
    if (!value) return "";
    return typeof value === "string" ? value : value._id;
  }

  function userLabel(userValue: Task["assignedTo"] | Task["completedBy"]): string {
    if (!userValue) return "—";
    if (typeof userValue !== "string") return userValue.name;
    const found = users.find((user) => user._id === userValue);
    return found ? found.name : "—";
  }

  function descriptionLines(description?: string): string[] {
    if (!description) return [];
    return description
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => (line.startsWith("- ") ? line.slice(2) : line));
  }

  function toggleTaskDetails(taskId: string) {
    setAutoExpandDisabled(true);
    setExpandedTaskId((current) => {
      const activeTaskId = current ?? autoExpandedTaskId;
      return activeTaskId === taskId ? null : taskId;
    });
  }

  async function handleAssignmentChange(
    taskId: string,
    field: "assignedTo" | "completedBy",
    selectedUserId: string,
  ) {
    setUpdatingTaskField(`${taskId}:${field}`);
    setAssignmentError(null);

    try {
      const payload: Record<string, string | undefined> = {};
      payload[field] = selectedUserId || undefined;

      const response = await api.put<{ task: Task }>(`/tasks/${taskId}`, payload);

      setTasks((current) =>
        current.map((task) => (task._id === taskId ? response.data.task : task)),
      );
    } catch (err) {
      setAssignmentError(getErrorMessage(err));
    } finally {
      setUpdatingTaskField(null);
    }
  }

  async function handleStatusChange(taskId: string, nextStatus: TaskStatus) {
    setUpdatingTaskField(`${taskId}:status`);
    setAssignmentError(null);

    try {
      const response = await api.put<{ task: Task }>(`/tasks/${taskId}`, { status: nextStatus });

      setTasks((current) =>
        current.map((task) => (task._id === taskId ? response.data.task : task)),
      );
    } catch (err) {
      setAssignmentError(getErrorMessage(err));
    } finally {
      setUpdatingTaskField(null);
    }
  }

  function resetForm() {
    setFormProject("");
    setFormTitle("");
    setFormDueDate("");
    setFormEstimateHours("");
    setFormError(null);
  }

  async function handleCreateTask(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await api.post("/tasks", {
        project: formProject,
        title: formTitle,
        dueDate: formDueDate,
        estimateHours: formEstimateHours ? Number(formEstimateHours) : undefined,
      });
      resetForm();
      setShowNewTaskForm(false);
      setStatus("");
      setSearch("");
      setDebouncedSearch("");
      setPage(1);
      setRefreshIndex((index) => index + 1);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page claims-page">
      <header className="page-header">
        <h1>Tasks</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowNewTaskForm((shown) => !shown)}
        >
          {showNewTaskForm ? "Cancel" : "New Task"}
        </button>
      </header>

      {showNewTaskForm && (
        <form className="card new-claim-form" onSubmit={handleCreateTask}>
          <div className="new-claim-form-field">
            <label htmlFor="task-project">Project</label>
            <select
              id="task-project"
              required
              value={formProject}
              onChange={(event) => setFormProject(event.target.value)}
            >
              <option value="" disabled>
                Select a project…
              </option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectCode} — {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="new-claim-form-field">
            <label htmlFor="task-title">Task Title</label>
            <input
              id="task-title"
              type="text"
              required
              value={formTitle}
              onChange={(event) => setFormTitle(event.target.value)}
            />
          </div>

          <div className="new-claim-form-field">
            <label htmlFor="task-due-date">Due Date</label>
            <input
              id="task-due-date"
              type="date"
              required
              value={formDueDate}
              onChange={(event) => setFormDueDate(event.target.value)}
            />
          </div>

          <div className="new-claim-form-field">
            <label htmlFor="task-estimate-hours">Estimate Hours</label>
            <input
              id="task-estimate-hours"
              type="number"
              min="0"
              step="0.5"
              value={formEstimateHours}
              onChange={(event) => setFormEstimateHours(event.target.value)}
            />
          </div>

          {formError && (
            <p role="alert" className="form-error">
              {formError}
            </p>
          )}

          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Creating…" : "Create Task"}
          </button>
        </form>
      )}

      <div className="claims-filters">
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as TaskStatus | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((taskStatus) => (
            <option key={taskStatus} value={taskStatus}>
              {TASK_STATUS_LABELS[taskStatus]}
            </option>
          ))}
        </select>

        <input
          type="search"
          placeholder="Search task # or title…"
          aria-label="Search tasks"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {assignmentError && (
        <p role="alert" className="form-error">
          {assignmentError}
        </p>
      )}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task #</th>
              <th>Project</th>
              <th>Title</th>
              <th>Est. Hours</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Assigned To</th>
              <th>Completed By</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const isExpanded = effectiveExpandedTaskId === task._id;
              const subtasks = descriptionLines(task.description);

              return (
                <Fragment key={task._id}>
                  <tr key={task._id} className={isExpanded ? "task-row-expanded" : undefined}>
                    <td>{task.taskNumber}</td>
                    <td>{projectLabel(task.project, projectsById)}</td>
                    <td>
                      <button
                        type="button"
                        className="task-title-button"
                        onClick={() => toggleTaskDetails(task._id)}
                        aria-expanded={isExpanded}
                      >
                        {task.title}
                      </button>
                    </td>
                    <td>{task.estimateHours != null ? numberFormatter.format(task.estimateHours) : "—"}</td>
                    <td>
                      <select
                        aria-label={`Status for task ${task.taskNumber}`}
                        className="task-assignment-select task-status-select"
                        data-status={task.status}
                        value={task.status}
                        onChange={(event) => {
                          void handleStatusChange(task._id, event.target.value as TaskStatus);
                        }}
                        disabled={updatingTaskField === `${task._id}:status`}
                      >
                        {TASK_STATUSES.map((taskStatus) => (
                          <option key={taskStatus} value={taskStatus}>
                            {TASK_STATUS_LABELS[taskStatus]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{dateFormatter.format(new Date(task.dueDate))}</td>
                    <td>
                      <select
                        aria-label={`Assign user for task ${task.taskNumber}`}
                        className="task-assignment-select"
                        value={userId(task.assignedTo)}
                        onChange={(event) => {
                          void handleAssignmentChange(task._id, "assignedTo", event.target.value);
                        }}
                        disabled={
                          task.status === "done" || updatingTaskField === `${task._id}:assignedTo`
                        }
                      >
                        <option value="">Unassigned</option>
                        {users.map((user) => (
                          <option key={user._id} value={user._id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`Completed by user for task ${task.taskNumber}`}
                        className="task-assignment-select"
                        value={userId(task.completedBy)}
                        onChange={(event) => {
                          void handleAssignmentChange(task._id, "completedBy", event.target.value);
                        }}
                        disabled={
                          task.status === "done" || updatingTaskField === `${task._id}:completedBy`
                        }
                      >
                        <option value="">Not completed</option>
                        {users.map((user) => (
                          <option key={user._id} value={user._id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr key={`${task._id}-details`}>
                      <td colSpan={8} className="task-details-cell">
                        <div className="card task-details-card">
                          <h3>Task Details</h3>
                          <div className="task-details-meta">
                            <p>
                              <strong>Task #:</strong> {task.taskNumber}
                            </p>
                            <p>
                              <strong>Project:</strong> {projectLabel(task.project, projectsById)}
                            </p>
                            <p>
                              <strong>Status:</strong> {TASK_STATUS_LABELS[task.status]}
                            </p>
                            <p>
                              <strong>Due:</strong> {dateFormatter.format(new Date(task.dueDate))}
                            </p>
                            <p>
                              <strong>Assigned To:</strong> {userLabel(task.assignedTo)}
                            </p>
                            <p>
                              <strong>Completed By:</strong> {userLabel(task.completedBy)}
                            </p>
                          </div>

                          <h4>Subtasks / Description</h4>
                          {subtasks.length > 0 ? (
                            <ul className="task-subtasks-list">
                              {subtasks.map((subtask, index) => (
                                <li key={`${task._id}-subtask-${index}`}>{subtask}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="task-subtasks-empty">No subtask details on this task.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan={8}>No tasks found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && <p>Loading tasks…</p>}

      {pagination && pagination.pages > 1 && (
        <div className="pagination">
          <button
            type="button"
            onClick={() => setPage((current) => current - 1)}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={page >= pagination.pages}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
