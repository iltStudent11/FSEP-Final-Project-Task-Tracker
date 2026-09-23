import { useEffect, useRef, useState, type ChangeEvent } from "react";
import api from "../api";
import { getErrorMessage } from "../errorMessage";
import type {
  AuditEventType,
  AuditLog,
  AuditLogsResponse,
  RestoreResponse,
  User,
  UserRole,
  UsersResponse,
} from "../types";

const RESTORE_CONFIRM_PHRASE = "RESTORE";

type UserDraft = {
  name: string;
  email: string;
  role: UserRole;
  password: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditUserFilter, setAuditUserFilter] = useState<string>("");
  const [auditEventType, setAuditEventType] = useState<AuditEventType | "">("");
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [backingUp, setBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get<UsersResponse>("/auth/users");
        if (!cancelled) {
          setUsers(response.data.users);
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

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAuditLogs() {
      setAuditLoading(true);
      setAuditError(null);

      try {
        const response = await api.get<AuditLogsResponse>("/audit", {
          params: {
            page: auditPage,
            limit: 20,
            user: auditUserFilter || undefined,
            eventType: auditEventType || undefined,
          },
        });

        if (!cancelled) {
          setAuditLogs(response.data.logs);
          setAuditTotalPages(response.data.pagination.pages);
        }
      } catch (err) {
        if (!cancelled) {
          setAuditError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setAuditLoading(false);
        }
      }
    }

    void loadAuditLogs();

    return () => {
      cancelled = true;
    };
  }, [auditEventType, auditPage, auditUserFilter]);

  function startEditing(user: User) {
    setEditingUserId(user._id);
    setDraft({
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
    });
    setError(null);
  }

  function cancelEditing() {
    setEditingUserId(null);
    setDraft(null);
  }

  async function saveUser(userId: string) {
    if (!draft) return;

    setSaving(true);
    setError(null);

    try {
      const payload: {
        name: string;
        email: string;
        role: UserRole;
        password?: string;
      } = {
        name: draft.name,
        email: draft.email,
        role: draft.role,
      };

      const password = draft.password.trim();
      if (password) {
        payload.password = password;
      }

      const response = await api.put<{ user: User }>(`/auth/users/${userId}`, payload);

      setUsers((current) =>
        current.map((user) => (user._id === userId ? response.data.user : user)),
      );
      setEditingUserId(null);
      setDraft(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(userId: string) {
    const confirmed = window.confirm("Delete this user permanently?");
    if (!confirmed) return;

    setDeletingUserId(userId);
    setError(null);

    try {
      await api.delete(`/auth/users/${userId}`);
      setUsers((current) => current.filter((user) => user._id !== userId));
      if (editingUserId === userId) {
        setEditingUserId(null);
        setDraft(null);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleBackup() {
    setBackingUp(true);
    setBackupError(null);

    try {
      const response = await api.get("/admin/backup", { responseType: "blob" });

      const contentDisposition = response.headers["content-disposition"] as string | undefined;
      const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `task-tracker-backup-${Date.now()}.json`;

      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setBackupError(getErrorMessage(err));
    } finally {
      setBackingUp(false);
    }
  }

  function handleRestoreFileChange(event: ChangeEvent<HTMLInputElement>) {
    setRestoreFile(event.target.files?.[0] ?? null);
    setRestoreConfirmText("");
    setRestoreError(null);
    setRestoreMessage(null);
  }

  async function handleRestore() {
    if (!restoreFile || restoreConfirmText !== RESTORE_CONFIRM_PHRASE) return;

    setRestoring(true);
    setRestoreError(null);
    setRestoreMessage(null);

    const text = await restoreFile.text();
    let backup: unknown;
    try {
      backup = JSON.parse(text);
    } catch {
      setRestoring(false);
      setRestoreError("That file isn't valid JSON.");
      return;
    }

    try {
      const response = await api.post<RestoreResponse>("/admin/restore", backup);
      const { counts } = response.data;

      setRestoreMessage(
        `Restored ${counts.users} user(s), ${counts.projects} project(s), and ${counts.tasks} task(s). ` +
          "Reload the page to see the restored data.",
      );
      setRestoreFile(null);
      setRestoreConfirmText("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      const usersResponse = await api.get<UsersResponse>("/auth/users");
      setUsers(usersResponse.data.users);
    } catch (err) {
      setRestoreError(getErrorMessage(err));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Admin</h1>
      </header>

      <p className="status-note">Manage user profiles, roles, access, and audit logs.</p>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading users…</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table" aria-label="Users table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isEditing = editingUserId === user._id;

                return (
                  <tr key={user._id}>
                    <td>
                      {isEditing && draft ? (
                        <input
                          className="field-input"
                          aria-label={`Name for ${user.email}`}
                          value={draft.name}
                          onChange={(event) =>
                            setDraft((current) =>
                              current ? { ...current, name: event.target.value } : current,
                            )
                          }
                        />
                      ) : (
                        user.name
                      )}
                    </td>
                    <td>
                      {isEditing && draft ? (
                        <input
                          className="field-input"
                          aria-label={`Email for ${user.name}`}
                          type="email"
                          value={draft.email}
                          onChange={(event) =>
                            setDraft((current) =>
                              current ? { ...current, email: event.target.value } : current,
                            )
                          }
                        />
                      ) : (
                        user.email
                      )}
                    </td>
                    <td>
                      {isEditing && draft ? (
                        <select
                          className="field-select"
                          aria-label={`Role for ${user.name}`}
                          value={draft.role}
                          onChange={(event) =>
                            setDraft((current) =>
                              current
                                ? { ...current, role: event.target.value as UserRole }
                                : current,
                            )
                          }
                        >
                          <option value="admin">admin</option>
                          <option value="lead">lead</option>
                          <option value="member">member</option>
                        </select>
                      ) : (
                        user.role
                      )}
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      {isEditing && draft ? (
                        <>
                          <input
                            className="field-input"
                            aria-label={`New password for ${user.name}`}
                            type="password"
                            placeholder="New password (optional)"
                            value={draft.password}
                            onChange={(event) =>
                              setDraft((current) =>
                                current ? { ...current, password: event.target.value } : current,
                              )
                            }
                          />
                          <div className="inline-actions" style={{ marginTop: "0.5rem" }}>
                            <button
                              type="button"
                              className="btn"
                              disabled={saving}
                              onClick={() => void saveUser(user._id)}
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button type="button" className="btn" onClick={cancelEditing}>
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="inline-actions">
                          <button type="button" className="btn" onClick={() => startEditing(user)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={deletingUserId === user._id}
                            onClick={() => void deleteUser(user._id)}
                          >
                            {deletingUserId === user._id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2>User Audit Log</h2>

        <div className="claims-filters" style={{ marginBottom: "1rem" }}>
          <select
            aria-label="Filter audit logs by user"
            className="field-select"
            value={auditUserFilter}
            onChange={(event) => {
              setAuditUserFilter(event.target.value);
              setAuditPage(1);
            }}
          >
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user._id} value={user._id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>

          <select
            aria-label="Filter audit logs by event type"
            className="field-select"
            value={auditEventType}
            onChange={(event) => {
              setAuditEventType(event.target.value as AuditEventType | "");
              setAuditPage(1);
            }}
          >
            <option value="">All event types</option>
            <option value="auth">auth</option>
            <option value="navigation">navigation</option>
            <option value="action">action</option>
          </select>
        </div>

        {auditError && (
          <p role="alert" className="form-error">
            {auditError}
          </p>
        )}

        {auditLoading ? (
          <p>Loading audit logs…</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table" aria-label="Audit log table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Event Type</th>
                    <th>Action</th>
                    <th>Path</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No audit logs found.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log._id}>
                        <td>{formatDate(log.createdAt)}</td>
                        <td>{log.actorEmail}</td>
                        <td>{log.actorRole}</td>
                        <td>{log.eventType}</td>
                        <td>{log.action}</td>
                        <td>{log.route ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="btn"
                disabled={auditPage <= 1}
                onClick={() => setAuditPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </button>
              <span>
                Page {auditPage} of {auditTotalPages}
              </span>
              <button
                type="button"
                className="btn"
                disabled={auditPage >= auditTotalPages}
                onClick={() => setAuditPage((page) => Math.min(auditTotalPages, page + 1))}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card admin-backup-card">
        <h2>Backup &amp; Restore</h2>
        <p className="status-note">
          Download a full JSON snapshot of the database (users, including password hashes,
          projects, and tasks), or restore from a previously downloaded snapshot.
        </p>

        <div className="admin-backup-section">
          <h3>Backup</h3>
          <p>Downloads a JSON file you can store safely and restore from later.</p>
          <button type="button" className="btn" disabled={backingUp} onClick={() => void handleBackup()}>
            {backingUp ? "Preparing download…" : "Download Backup"}
          </button>
          {backupError && (
            <p role="alert" className="form-error">
              {backupError}
            </p>
          )}
        </div>

        <div className="admin-backup-section">
          <h3>Restore</h3>
          <p className="form-error">
            Restoring permanently deletes all current users, projects, and tasks and replaces
            them with the contents of the uploaded file. This cannot be undone.
          </p>

          <label htmlFor="restore-file">Backup file</label>
          <input
            id="restore-file"
            type="file"
            accept="application/json"
            ref={fileInputRef}
            onChange={handleRestoreFileChange}
          />

          {restoreFile && (
            <>
              <label htmlFor="restore-confirm">
                Type <strong>{RESTORE_CONFIRM_PHRASE}</strong> to confirm
              </label>
              <input
                id="restore-confirm"
                className="field-input"
                type="text"
                value={restoreConfirmText}
                onChange={(event) => setRestoreConfirmText(event.target.value)}
                autoComplete="off"
              />

              <div className="inline-actions" style={{ marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={restoring || restoreConfirmText !== RESTORE_CONFIRM_PHRASE}
                  onClick={() => void handleRestore()}
                >
                  {restoring ? "Restoring…" : "Restore Database"}
                </button>
              </div>
            </>
          )}

          {restoreError && (
            <p role="alert" className="form-error">
              {restoreError}
            </p>
          )}
          {restoreMessage && <p className="form-success">{restoreMessage}</p>}
        </div>
      </div>
    </section>
  );
}
