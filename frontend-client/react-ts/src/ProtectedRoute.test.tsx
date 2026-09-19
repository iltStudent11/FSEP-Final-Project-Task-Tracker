import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TOKEN_STORAGE_KEY } from "./api";
import { AuthProvider, USER_STORAGE_KEY } from "./AuthContext";
import ProtectedRoute from "./ProtectedRoute";
import type { User } from "./types";

const mockUser: User = {
  _id: "user-1",
  name: "Alice Adjuster",
  email: "alice@policyclaims.com",
  role: "adjuster",
  createdAt: new Date().toISOString(),
};

function renderAtRoot() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("redirects unauthenticated users to /login", () => {
    renderAtRoot();

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders the protected content for authenticated users", () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, "test-token");
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));

    renderAtRoot();

    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });
});
