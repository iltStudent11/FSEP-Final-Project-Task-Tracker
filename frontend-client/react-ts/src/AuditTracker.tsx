import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "./api";
import { useAuth } from "./useAuth";

function tabName(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/projects")) return "Projects";
  if (pathname.startsWith("/tasks")) return "Tasks";
  if (pathname.startsWith("/admin")) return "Admin";
  return pathname;
}

export default function AuditTracker() {
  const location = useLocation();
  const { user, token } = useAuth();

  useEffect(() => {
    if (!user || !token) return;

    void api
      .post("/audit/events", {
        tab: tabName(location.pathname),
        path: location.pathname,
      })
      .catch(() => null);
  }, [location.pathname, token, user]);

  return null;
}
