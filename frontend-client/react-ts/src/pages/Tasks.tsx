import { useEffect, useState, type SubmitEvent } from "react";
import api from "../api";
import { getErrorMessage } from "../errorMessage";
import StatusBadge from "../StatusBadge";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_STATUS_TONE } from "../claimStatus";
import type { PaginatedTasks, Project, Task, TaskStatus } from "../types";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function projectLabel(project: Task["project"], projectsById: Map<string, Project>): string {
  if (typeof project !== "string") return project.projectCode;
  return projectsById.get(project)?.projectCode ?? project;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState<PaginatedTasks["pagination"] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<TaskStatus | "">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshIndex, setRefreshIndex] = useState(0);

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
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task._id}>
                <td>{task.taskNumber}</td>
                <td>{projectLabel(task.project, projectsById)}</td>
                <td>{task.title}</td>
                <td>{task.estimateHours != null ? numberFormatter.format(task.estimateHours) : "—"}</td>
                <td>
                  <StatusBadge
                    label={TASK_STATUS_LABELS[task.status]}
                    tone={TASK_STATUS_TONE[task.status]}
                  />
                </td>
                <td>{dateFormatter.format(new Date(task.dueDate))}</td>
              </tr>
            ))}
            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan={6}>No tasks found.</td>
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
