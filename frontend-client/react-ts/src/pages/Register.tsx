import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../useAuth";
import { getErrorMessage } from "../errorMessage";
import type { UserRole } from "../types";

export default function Register() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("adjuster");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await register(name, email, password, role);
      // Registration does not return a token, so the user still has to log in.
      navigate("/login", { state: { justRegistered: true } });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <section className="auth-page">
      <h1>Register</h1>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <label htmlFor="role">Role</label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
        >
          <option value="adjuster">Adjuster</option>
          <option value="admin">Admin</option>
        </select>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Registering…" : "Register"}
        </button>
      </form>

      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
