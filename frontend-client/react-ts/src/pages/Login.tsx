import { useState, type SubmitEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../useAuth";
import { getErrorMessage } from "../errorMessage";

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = Boolean((location.state as { justRegistered?: boolean } | null)?.justRegistered);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <section className="auth-page">
      <h1>Log in</h1>

      {justRegistered && (
        <p className="form-success">Account created — log in to continue.</p>
      )}

      <form onSubmit={handleSubmit} noValidate>
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </section>
  );
}
