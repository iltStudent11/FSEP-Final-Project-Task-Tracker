import { useEffect, useState } from "react";
import api from "../api";
import { getErrorMessage } from "../errorMessage";
import type { User, UserRole, UsersResponse } from "../types";

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

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

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

  return (
    <section className="page">
      <header className="page-header">
        <h1>Admin</h1>
      </header>

      <p className="status-note">Manage user profiles, roles, and access.</p>

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
    </section>
  );
}
