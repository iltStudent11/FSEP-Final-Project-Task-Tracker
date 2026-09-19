import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import Banner from "./Banner";
import { useAuth } from "./useAuth";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Banner />
      {children}
    </>
  );
}
