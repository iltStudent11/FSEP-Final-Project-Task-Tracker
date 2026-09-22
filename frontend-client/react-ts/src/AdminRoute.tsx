import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
