import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../AuthContext";
import Login from "./Login";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Login page", () => {
  it("renders email and password fields", () => {
    renderLogin();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("type", "email");

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");
  });

  it("renders a submit button", () => {
    renderLogin();

    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });
});
