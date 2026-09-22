import { Link } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function Banner() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="app-banner">
      <div className="app-banner-identity">
        <span className="app-banner-brand">Project Task Tracker</span>
        <Link to="/" className="app-banner-title">
          Welcome, {user.name}
        </Link>
        <span className="role-badge" data-role={user.role}>
          {user.role}
        </span>
      </div>
      <nav className="app-banner-nav">
        <Link to="/">Dashboard</Link>
        <Link to="/projects">Projects</Link>
        <Link to="/tasks">Tasks</Link>
        {user.role === "admin" && <Link to="/admin">Admin</Link>}
        <button type="button" onClick={logout}>
          Log out
        </button>
      </nav>
    </header>
  );
}
