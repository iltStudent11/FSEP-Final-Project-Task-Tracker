import { Fragment, useEffect, useState, type SubmitEvent } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { getErrorMessage } from "../errorMessage";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "../claimStatus";
import type { PaginatedTasks, Project, Task, TaskStatus, User, UsersResponse } from "../types";

// dueDate is stored as a UTC-midnight calendar date; formatting in the
// viewer's local timezone can shift it back a day (e.g. UTC midnight
// displays as the prior evening west of UTC) — force UTC to keep it stable.
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const noteDateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

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
  const [formSubtasksText, setFormSubtasksText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [suggestingSubtasks, setSuggestingSubtasks] = useState(false);

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteError, setNoteError] = useState<string | null>(null);
  const [submittingNoteTaskId, setSubmittingNoteTaskId] = useState<string | null>(null);

  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState<string | null>(null);
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({});
  const [submittingSubtaskTaskId, setSubmittingSubtaskTaskId] = useState<string | null>(null);

  const [estimateHoursDrafts, setEstimateHoursDrafts] = useState<Record<string, string>>({});

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

  function toggleTaskDetails(taskId: string) {
    setAutoExpandDisabled(true);
    setExpandedTaskId((current) => {
      const activeTaskId = current ?? autoExpandedTaskId;
      return activeTaskId === taskId ? null : taskId;
    });
  }

  async function handleTaskFieldUpdate(
    taskId: string,
    field: string,
    value: string | number | undefined,
  ) {
    setUpdatingTaskField(`${taskId}:${field}`);
    setAssignmentError(null);

    try {
      const response = await api.put<{ task: Task }>(`/tasks/${taskId}`, { [field]: value });

      setTasks((current) =>
        current.map((task) => (task._id === taskId ? response.data.task : task)),
      );
    } catch (err) {
      setAssignmentError(getErrorMessage(err));
    } finally {
      setUpdatingTaskField(null);
    }
  }

  function handleAssignmentChange(
    taskId: string,
    field: "assignedTo" | "completedBy",
    selectedUserId: string,
  ) {
    return handleTaskFieldUpdate(taskId, field, selectedUserId || undefined);
  }

  function handleStatusChange(taskId: string, nextStatus: TaskStatus) {
    return handleTaskFieldUpdate(taskId, "status", nextStatus);
  }

  function estimateHoursValue(task: Task): string {
    const draft = estimateHoursDrafts[task._id];
    if (draft !== undefined) return draft;
    return task.estimateHours != null ? String(task.estimateHours) : "";
  }

  async function handleEstimateHoursBlur(task: Task) {
    const draft = estimateHoursDrafts[task._id];
    if (draft === undefined) return;

    setEstimateHoursDrafts((current) => {
      const next = { ...current };
      delete next[task._id];
      return next;
    });

    const trimmed = draft.trim();
    const parsed = trimmed === "" ? undefined : Number(trimmed);

    if (trimmed !== "" && (Number.isNaN(parsed) || (parsed as number) < 0)) {
      setAssignmentError("Estimate hours must be a non-negative number");
      return;
    }

    if (parsed === task.estimateHours) return;

    await handleTaskFieldUpdate(task._id, "estimateHours", parsed);
  }

  async function handleAddNote(taskId: string) {
    const text = (noteDrafts[taskId] ?? "").trim();
    if (!text) return;

    setSubmittingNoteTaskId(taskId);
    setNoteError(null);

    try {
      const response = await api.post<{ task: Task }>(`/tasks/${taskId}/notes`, { text });

      setTasks((current) =>
        current.map((task) => (task._id === taskId ? response.data.task : task)),
      );
      setNoteDrafts((current) => ({ ...current, [taskId]: "" }));
    } catch (err) {
      setNoteError(getErrorMessage(err));
    } finally {
      setSubmittingNoteTaskId(null);
    }
  }

  async function handleToggleSubtask(taskId: string, subtaskId: string, completed: boolean) {
    setUpdatingSubtaskId(subtaskId);
    setSubtaskError(null);

    try {
      const response = await api.patch<{ task: Task }>(
        `/tasks/${taskId}/subtasks/${subtaskId}`,
        { completed },
      );

      setTasks((current) =>
        current.map((task) => (task._id === taskId ? response.data.task : task)),
      );
    } catch (err) {
      setSubtaskError(getErrorMessage(err));
    } finally {
      setUpdatingSubtaskId(null);
    }
  }

  async function handleAddSubtask(taskId: string) {
    const text = (subtaskDrafts[taskId] ?? "").trim();
    if (!text) return;

    setSubmittingSubtaskTaskId(taskId);
    setSubtaskError(null);

    try {
      const response = await api.post<{ task: Task }>(`/tasks/${taskId}/subtasks`, { text });

      setTasks((current) =>
        current.map((task) => (task._id === taskId ? response.data.task : task)),
      );
      setSubtaskDrafts((current) => ({ ...current, [taskId]: "" }));
    } catch (err) {
      setSubtaskError(getErrorMessage(err));
    } finally {
      setSubmittingSubtaskTaskId(null);
    }
  }

  function resetForm() {
    setFormProject("");
    setFormTitle("");
    setFormDueDate("");
    setFormEstimateHours("");
    setFormSubtasksText("");
    setFormError(null);
  }

  async function handleSuggestSubtasks() {
    const title = formTitle.trim();
    if (!title) {
      setFormError("Enter a task title first to generate AI subtasks");
      return;
    }

    setSuggestingSubtasks(true);
    setFormError(null);

    try {
      const response = await api.post<{ subtasks: string[] }>("/tasks/ai-suggest-subtasks", {
        title,
      });
      setFormSubtasksText(response.data.subtasks.join("\n"));
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSuggestingSubtasks(false);
    }
  }

  async function handleCreateTask(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const subtasks = formSubtasksText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      await api.post("/tasks", {
        project: formProject,
        title: formTitle,
        dueDate: formDueDate,
        estimateHours: formEstimateHours ? Number(formEstimateHours) : undefined,
        subtasks,
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
            <button
              type="button"
              className="btn"
              onClick={() => void handleSuggestSubtasks()}
              disabled={suggestingSubtasks}
            >
              {suggestingSubtasks ? "Generating…" : "AI Suggest Subtasks"}
            </button>
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

          <div className="new-claim-form-field">
            <label htmlFor="task-subtasks">Subtasks (one per line)</label>
            <textarea
              id="task-subtasks"
              rows={5}
              value={formSubtasksText}
              onChange={(event) => setFormSubtasksText(event.target.value)}
              placeholder="Use AI Suggest Subtasks or type your own list"
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
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        aria-label={`Estimate hours for task ${task.taskNumber}`}
                        className="task-assignment-select"
                        value={estimateHoursValue(task)}
                        onChange={(event) =>
                          setEstimateHoursDrafts((current) => ({
                            ...current,
                            [task._id]: event.target.value,
                          }))
                        }
                        onBlur={() => void handleEstimateHoursBlur(task)}
                        disabled={updatingTaskField === `${task._id}:estimateHours`}
                      />
                    </td>
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
                    <td>
                      <input
                        type="date"
                        aria-label={`Due date for task ${task.taskNumber}`}
                        className="task-assignment-select"
                        value={task.dueDate.slice(0, 10)}
                        onChange={(event) =>
                          void handleTaskFieldUpdate(task._id, "dueDate", event.target.value)
                        }
                        disabled={updatingTaskField === `${task._id}:dueDate`}
                      />
                    </td>
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

                          {task.description && (
                            <>
                              <h4>Description</h4>
                              <p>{task.description}</p>
                            </>
                          )}

                          <h4>Subtasks</h4>
                          {task.subtasks.length > 0 ? (
                            <ul className="task-subtasks-list">
                              {task.subtasks.map((subtask) => (
                                <li key={subtask._id} className="task-subtask-item">
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={subtask.completed}
                                      disabled={updatingSubtaskId === subtask._id}
                                      onChange={(event) =>
                                        void handleToggleSubtask(
                                          task._id,
                                          subtask._id,
                                          event.target.checked,
                                        )
                                      }
                                    />
                                    <span className={subtask.completed ? "task-subtask-done" : undefined}>
                                      {subtask.text}
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="task-subtasks-empty">No subtasks on this task.</p>
                          )}

                          <form
                            className="task-subtask-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void handleAddSubtask(task._id);
                            }}
                          >
                            <input
                              id={`task-subtask-${task._id}`}
                              type="text"
                              aria-label={`Add a subtask to task ${task.taskNumber}`}
                              placeholder="Add a subtask…"
                              value={subtaskDrafts[task._id] ?? ""}
                              onChange={(event) =>
                                setSubtaskDrafts((current) => ({
                                  ...current,
                                  [task._id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="submit"
                              className="btn"
                              disabled={
                                submittingSubtaskTaskId === task._id ||
                                !(subtaskDrafts[task._id] ?? "").trim()
                              }
                            >
                              {submittingSubtaskTaskId === task._id ? "Adding…" : "Add Subtask"}
                            </button>
                          </form>
                          {subtaskError && (
                            <p role="alert" className="form-error">
                              {subtaskError}
                            </p>
                          )}

                          <h4>Notes</h4>
                          {task.notes.length > 0 ? (
                            <ul className="task-notes-list">
                              {task.notes.map((note, index) => (
                                <li key={`${task._id}-note-${index}`} className="task-note">
                                  <p className="task-note-meta">
                                    <strong>{userLabel(note.author)}</strong>
                                    {" · "}
                                    {noteDateFormatter.format(new Date(note.createdAt))}
                                  </p>
                                  <p className="task-note-text">{note.text}</p>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="task-subtasks-empty">No notes on this task yet.</p>
                          )}

                          <form
                            className="task-note-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void handleAddNote(task._id);
                            }}
                          >
                            <textarea
                              id={`task-note-${task._id}`}
                              aria-label={`Add a note to task ${task.taskNumber}`}
                              rows={2}
                              placeholder="Add a note…"
                              value={noteDrafts[task._id] ?? ""}
                              onChange={(event) =>
                                setNoteDrafts((current) => ({
                                  ...current,
                                  [task._id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="submit"
                              className="btn"
                              disabled={
                                submittingNoteTaskId === task._id ||
                                !(noteDrafts[task._id] ?? "").trim()
                              }
                            >
                              {submittingNoteTaskId === task._id ? "Adding…" : "Add Note"}
                            </button>
                          </form>
                          {noteError && (
                            <p role="alert" className="form-error">
                              {noteError}
                            </p>
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
