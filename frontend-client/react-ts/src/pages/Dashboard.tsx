import { useEffect, useState } from "react";
import api from "../api";
import { getErrorMessage } from "../errorMessage";
import { useAuth } from "../useAuth";
import StatusBadge from "../StatusBadge";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS, TASK_STATUS_TONE } from "../claimStatus";
import { PROJECT_CATEGORY_LABELS } from "../policyMeta";
import type { AiRiskRadar, DashboardStats, Project, ProjectCategory, TaskStatus } from "../types";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

function projectCode(project: DashboardStats["recentTasks"][number]["project"]): string {
  return typeof project === "string" ? project : (project as Project).projectCode;
}

function categoryLabel(category: ProjectCategory): string {
  return PROJECT_CATEGORY_LABELS[category] ?? category;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [riskRadar, setRiskRadar] = useState<AiRiskRadar | null>(null);
  const [riskRadarUnavailable, setRiskRadarUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setError(null);
      setRiskRadarUnavailable(false);

      try {
        const [statsResult, riskResult] = await Promise.allSettled([
          api.get<DashboardStats>("/dashboard"),
          api.get<AiRiskRadar>("/dashboard/ai-risk-radar"),
        ]);

        if (!cancelled) {
          if (statsResult.status === "fulfilled") {
            setStats(statsResult.value.data);
          } else {
            setStats(null);
            setError(getErrorMessage(statsResult.reason));
          }

          if (riskResult.status === "fulfilled") {
            setRiskRadar(riskResult.value.data);
          } else {
            setRiskRadar(null);
            setRiskRadarUnavailable(true);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const maxStatusCount = stats ? Math.max(1, ...(Object.values(stats.tasksByStatus) as number[])) : 1;

  return (
    <section className="page dashboard-page">
      <h1>Dashboard</h1>

      {loading && <p>Loading dashboard…</p>}

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {stats && (
        <>
          {riskRadar && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h2>AI Risk Radar</h2>
              <p>
                <strong>Risk Score:</strong> {riskRadar.riskScore}/100
              </p>
              <p>
                <StatusBadge
                  label={riskRadar.riskLevel.toUpperCase()}
                  tone={
                    riskRadar.riskLevel === "high"
                      ? "danger"
                      : riskRadar.riskLevel === "medium"
                        ? "warning"
                        : "success"
                  }
                />
              </p>
              <p>{riskRadar.summary}</p>
              <ul>
                <li>Blocked tasks: {riskRadar.drivers.blockedTasks}</li>
                <li>Overdue open tasks: {riskRadar.drivers.overdueOpenTasks}</li>
                <li>Due in 3 days: {riskRadar.drivers.dueSoonOpenTasks}</li>
              </ul>
            </div>
          )}

          {riskRadarUnavailable && (
            <p role="status">Risk Radar temporarily unavailable.</p>
          )}

          <div className="stat-cards">
            <div className="card stat-card">
              <span className="stat-card-label">Total Tasks</span>
              <span className="stat-card-value">{stats.totalTasks}</span>
            </div>
            <div className="card stat-card">
              <span className="stat-card-label">Total Projects</span>
              <span className="stat-card-value">{stats.totalProjects}</span>
            </div>
            <div className="card stat-card">
              <span className="stat-card-label">Total Users</span>
              <span className="stat-card-value">{stats.totalUsers}</span>
            </div>
            <div className="card stat-card">
              <span className="stat-card-label">Total Estimated Hours</span>
              <span className="stat-card-value">
                {numberFormatter.format(stats.totalEstimateHours)}
              </span>
            </div>
          </div>

          <h2>Tasks by Status</h2>
          <div className="status-chart">
            {(Object.entries(stats.tasksByStatus) as [TaskStatus, number][]).map(([status, count]) => (
              <div className="status-chart-row" key={status}>
                <span className="status-chart-label">
                  {TASK_STATUS_LABELS[status as TaskStatus] ?? status}
                </span>
                <div className="status-chart-track">
                  <div
                    className="status-chart-bar"
                    style={{
                      width: `${(count / maxStatusCount) * 100}%`,
                      background: TASK_STATUS_COLORS[status as TaskStatus],
                    }}
                  />
                </div>
                <span className="status-chart-count">{count}</span>
              </div>
            ))}
          </div>

          <h2>Projects by Category</h2>
          <div className="status-chart">
            {(Object.entries(stats.projectsByCategory) as [ProjectCategory, number][]).map(([category, count]) => (
              <div className="status-chart-row" key={category}>
                <span className="status-chart-label">
                  {categoryLabel(category)}
                </span>
                <span className="status-chart-count">{count}</span>
              </div>
            ))}
          </div>

          <h2>Recent Tasks</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task #</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Est. Hours</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentTasks.map((task) => (
                  <tr key={task._id}>
                    <td>{task.taskNumber}</td>
                    <td>{projectCode(task.project)}</td>
                    <td>
                      <StatusBadge
                        label={TASK_STATUS_LABELS[task.status]}
                        tone={TASK_STATUS_TONE[task.status]}
                      />
                    </td>
                    <td>
                      {task.estimateHours != null ? numberFormatter.format(task.estimateHours) : "—"}
                    </td>
                    <td>{dateFormatter.format(new Date(task.createdAt))}</td>
                  </tr>
                ))}
                {stats.recentTasks.length === 0 && (
                  <tr>
                    <td colSpan={5}>No tasks yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
