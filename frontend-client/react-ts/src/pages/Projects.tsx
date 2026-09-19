import { Fragment, useEffect, useState, type SubmitEvent } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { getErrorMessage } from "../errorMessage";
import StatusBadge from "../StatusBadge";
import { TASK_STATUS_LABELS, TASK_STATUS_TONE } from "../claimStatus";
import {
  PROJECT_CATEGORIES,
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONE,
} from "../policyMeta";
import type {
  PaginatedProjects,
  PaginatedTasks,
  Project,
  ProjectCategory,
  ProjectStatus,
  Task,
} from "../types";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [pagination, setPagination] = useState<PaginatedProjects["pagination"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<ProjectCategory | "">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [formProjectCode, setFormProjectCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<ProjectCategory>("web");
  const [formBudgetHours, setFormBudgetHours] = useState("");
  const [formStatus, setFormStatus] = useState<ProjectStatus>("active");
  const [formStartDate, setFormStartDate] = useState("");
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [tasksByProjectId, setTasksByProjectId] = useState<Record<string, Task[]>>({});
  const [loadingTasksForProjectId, setLoadingTasksForProjectId] = useState<string | null>(null);
  const [taskErrorByProjectId, setTaskErrorByProjectId] = useState<Record<string, string>>({});

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get<PaginatedProjects>("/projects", {
          params: {
            category: category || undefined,
            search: debouncedSearch || undefined,
            page,
            limit: 10,
          },
        });
        if (!cancelled) {
          setProjects(response.data.projects);
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

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, [category, debouncedSearch, page, refreshIndex]);

  useEffect(() => {
    if (!expandedProjectId) return;

    const existsInList = projects.some((project) => project._id === expandedProjectId);
    if (!existsInList) {
      setExpandedProjectId(null);
    }
  }, [projects, expandedProjectId]);

  function resetForm() {
    setFormProjectCode("");
    setFormName("");
    setFormCategory("web");
    setFormBudgetHours("");
    setFormStatus("active");
    setFormStartDate("");
    setFormTargetDate("");
    setFormError(null);
  }

  async function handleCreateProject(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await api.post("/projects", {
        projectCode: formProjectCode,
        name: formName,
        category: formCategory,
        budgetHours: Number(formBudgetHours),
        status: formStatus,
        startDate: formStartDate,
        targetDate: formTargetDate,
      });
      resetForm();
      setShowNewProjectForm(false);
      setCategory("");
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

  async function handleDelete(projectId: string) {
    setDeletingId(projectId);
    setDeleteError(null);

    try {
      await api.delete(`/projects/${projectId}`);
      setConfirmingDeleteId(null);
      setRefreshIndex((index) => index + 1);
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function loadProjectTasks(projectId: string) {
    setLoadingTasksForProjectId(projectId);
    setTaskErrorByProjectId((previous) => {
      const next = { ...previous };
      delete next[projectId];
      return next;
    });

    try {
      const response = await api.get<PaginatedTasks>("/tasks", {
        params: {
          project: projectId,
          page: 1,
          limit: 100,
        },
      });

      setTasksByProjectId((previous) => ({
        ...previous,
        [projectId]: response.data.tasks,
      }));
    } catch (err) {
      setTaskErrorByProjectId((previous) => ({
        ...previous,
        [projectId]: getErrorMessage(err),
      }));
    } finally {
      setLoadingTasksForProjectId((current) => (current === projectId ? null : current));
    }
  }

  async function toggleProjectDetails(projectId: string) {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      return;
    }

    setExpandedProjectId(projectId);

    if (!tasksByProjectId[projectId]) {
      await loadProjectTasks(projectId);
    }
  }

  return (
    <section className="page policies-page">
      <header className="page-header">
        <h1>Projects</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowNewProjectForm((shown) => !shown)}
        >
          {showNewProjectForm ? "Cancel" : "New Project"}
        </button>
      </header>

      {showNewProjectForm && (
        <form className="card new-policy-form" onSubmit={handleCreateProject}>
          <div className="new-policy-form-field">
            <label htmlFor="project-code">Project Code</label>
            <input
              id="project-code"
              type="text"
              required
              value={formProjectCode}
              onChange={(event) => setFormProjectCode(event.target.value)}
            />
          </div>

          <div className="new-policy-form-field">
            <label htmlFor="project-name">Project Name</label>
            <input
              id="project-name"
              type="text"
              required
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
            />
          </div>

          <div className="new-policy-form-field">
            <label htmlFor="project-category">Category</label>
            <select
              id="project-category"
              required
              value={formCategory}
              onChange={(event) => setFormCategory(event.target.value as ProjectCategory)}
            >
              {PROJECT_CATEGORIES.map((projectCategory) => (
                <option key={projectCategory} value={projectCategory}>
                  {PROJECT_CATEGORY_LABELS[projectCategory]}
                </option>
              ))}
            </select>
          </div>

          <div className="new-policy-form-field">
            <label htmlFor="project-budget-hours">Budget Hours</label>
            <input
              id="project-budget-hours"
              type="number"
              min="0"
              step="0.5"
              required
              value={formBudgetHours}
              onChange={(event) => setFormBudgetHours(event.target.value)}
            />
          </div>

          <div className="new-policy-form-field">
            <label htmlFor="project-status">Status</label>
            <select
              id="project-status"
              required
              value={formStatus}
              onChange={(event) => setFormStatus(event.target.value as ProjectStatus)}
            >
              {PROJECT_STATUSES.map((projectStatus) => (
                <option key={projectStatus} value={projectStatus}>
                  {PROJECT_STATUS_LABELS[projectStatus]}
                </option>
              ))}
            </select>
          </div>

          <div className="new-policy-form-field">
            <label htmlFor="project-start-date">Start Date</label>
            <input
              id="project-start-date"
              type="date"
              required
              value={formStartDate}
              onChange={(event) => setFormStartDate(event.target.value)}
            />
          </div>

          <div className="new-policy-form-field">
            <label htmlFor="project-target-date">Target Date</label>
            <input
              id="project-target-date"
              type="date"
              required
              value={formTargetDate}
              onChange={(event) => setFormTargetDate(event.target.value)}
            />
          </div>

          {formError && (
            <p role="alert" className="form-error">
              {formError}
            </p>
          )}

          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Creating…" : "Create Project"}
          </button>
        </form>
      )}

      <div className="policies-filters">
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value as ProjectCategory | "");
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {PROJECT_CATEGORIES.map((projectCategory) => (
            <option key={projectCategory} value={projectCategory}>
              {PROJECT_CATEGORY_LABELS[projectCategory]}
            </option>
          ))}
        </select>

        <input
          type="search"
          placeholder="Search project code or name…"
          aria-label="Search projects"
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

      {deleteError && (
        <p role="alert" className="form-error">
          {deleteError}
        </p>
      )}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Project Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Budget Hours</th>
              <th>Status</th>
              <th>Start</th>
              <th>Target</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const isExpanded = expandedProjectId === project._id;
              const projectTasks = tasksByProjectId[project._id] ?? [];
              const loadingProjectTasks = loadingTasksForProjectId === project._id;
              const projectTaskError = taskErrorByProjectId[project._id];

              return (
                <Fragment key={project._id}>
                  <tr className={isExpanded ? "project-row-expanded" : undefined}>
                    <td>{project.projectCode}</td>
                    <td>
                      <button
                        type="button"
                        className="project-title-button"
                        onClick={() => {
                          void toggleProjectDetails(project._id);
                        }}
                        aria-expanded={isExpanded}
                      >
                        {project.name}
                      </button>
                    </td>
                    <td>{PROJECT_CATEGORY_LABELS[project.category]}</td>
                    <td>{numberFormatter.format(project.budgetHours)}</td>
                    <td>
                      <StatusBadge
                        label={PROJECT_STATUS_LABELS[project.status]}
                        tone={PROJECT_STATUS_TONE[project.status]}
                      />
                    </td>
                    <td>{dateFormatter.format(new Date(project.startDate))}</td>
                    <td>{dateFormatter.format(new Date(project.targetDate))}</td>
                    <td className="policies-table-actions">
                      {confirmingDeleteId === project._id ? (
                        <span className="policy-delete-confirm">
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleDelete(project._id)}
                            disabled={deletingId === project._id}
                          >
                            {deletingId === project._id ? "Deleting…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setConfirmingDeleteId(null)}
                            disabled={deletingId === project._id}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => setConfirmingDeleteId(project._id)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="project-details-cell">
                        <div className="card project-details-card">
                          <h3>Project Details</h3>
                          <div className="project-details-meta">
                            <p>
                              <strong>Code:</strong> {project.projectCode}
                            </p>
                            <p>
                              <strong>Category:</strong> {PROJECT_CATEGORY_LABELS[project.category]}
                            </p>
                            <p>
                              <strong>Status:</strong> {PROJECT_STATUS_LABELS[project.status]}
                            </p>
                            <p>
                              <strong>Budget Hours:</strong> {numberFormatter.format(project.budgetHours)}
                            </p>
                            <p>
                              <strong>Start:</strong> {dateFormatter.format(new Date(project.startDate))}
                            </p>
                            <p>
                              <strong>Target:</strong> {dateFormatter.format(new Date(project.targetDate))}
                            </p>
                          </div>

                          <h4>Associated Tasks ({projectTasks.length})</h4>

                          {loadingProjectTasks && <p>Loading associated tasks…</p>}

                          {projectTaskError && (
                            <p role="alert" className="form-error">
                              {projectTaskError}
                            </p>
                          )}

                          {!loadingProjectTasks && !projectTaskError && projectTasks.length === 0 && (
                            <p className="project-tasks-empty">No tasks found for this project.</p>
                          )}

                          {!loadingProjectTasks && !projectTaskError && projectTasks.length > 0 && (
                            <div className="table-scroll">
                              <table className="data-table project-tasks-table">
                                <thead>
                                  <tr>
                                    <th>Task #</th>
                                    <th>Title</th>
                                    <th>Status</th>
                                    <th>Est. Hours</th>
                                    <th>Due</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {projectTasks.map((task) => (
                                    <tr key={task._id}>
                                      <td>{task.taskNumber}</td>
                                      <td>
                                        <Link
                                          to={`/tasks?search=${encodeURIComponent(task.taskNumber)}`}
                                          state={{ focusTaskId: task._id }}
                                        >
                                          {task.title}
                                        </Link>
                                      </td>
                                      <td>
                                        <StatusBadge
                                          label={TASK_STATUS_LABELS[task.status]}
                                          tone={TASK_STATUS_TONE[task.status]}
                                        />
                                      </td>
                                      <td>
                                        {task.estimateHours != null
                                          ? numberFormatter.format(task.estimateHours)
                                          : "—"}
                                      </td>
                                      <td>{dateFormatter.format(new Date(task.dueDate))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!loading && projects.length === 0 && (
              <tr>
                <td colSpan={8}>No projects found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && <p>Loading projects…</p>}

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
