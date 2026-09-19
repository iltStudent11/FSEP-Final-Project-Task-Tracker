import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TOKEN_STORAGE_KEY } from "./api";
import { AuthProvider, USER_STORAGE_KEY } from "./AuthContext";
import { useAuth } from "./useAuth";
import type { User } from "./types";

const mockUser: User = {
  _id: "user-1",
  name: "Alice Adjuster",
  email: "alice@policyclaims.com",
  role: "adjuster",
  createdAt: new Date().toISOString(),
};

function AuthConsumer() {
  const { user, token, logout } = useAuth();
  return (
    <div>
      <span data-testid="user-name">{user?.name ?? "none"}</span>
      <span data-testid="token">{token ?? "none"}</span>
      <button onClick={logout}>Log out</button>
    </div>
  );
}

function renderConsumer() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
}

describe("AuthContext", () => {
  it("starts with no user/token when localStorage is empty", () => {
    renderConsumer();

    expect(screen.getByTestId("user-name")).toHaveTextContent("none");
    expect(screen.getByTestId("token")).toHaveTextContent("none");
  });

  it("restores the user and token from localStorage on mount", () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, "stored-token");
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));

    renderConsumer();

    expect(screen.getByTestId("user-name")).toHaveTextContent("Alice Adjuster");
    expect(screen.getByTestId("token")).toHaveTextContent("stored-token");
  });

  it("logout clears the stored auth state", async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, "stored-token");
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));

    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByRole("button", { name: /log out/i }));

    expect(screen.getByTestId("user-name")).toHaveTextContent("none");
    expect(screen.getByTestId("token")).toHaveTextContent("none");
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
  });
});
