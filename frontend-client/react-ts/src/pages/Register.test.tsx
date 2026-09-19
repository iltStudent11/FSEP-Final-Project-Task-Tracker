import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../AuthContext";
import Register from "./Register";

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <AuthProvider>
        <Register />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Register page", () => {
  it("renders name, email, password, and role fields", () => {
    renderRegister();

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("type", "email");

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");

    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
  });

  it("defaults role to adjuster and offers admin as an option", () => {
    renderRegister();

    const roleSelect = screen.getByLabelText(/role/i) as HTMLSelectElement;
    expect(roleSelect.value).toBe("adjuster");
    expect(screen.getByRole("option", { name: /admin/i })).toBeInTheDocument();
  });

  it("renders a submit button", () => {
    renderRegister();

    expect(screen.getByRole("button", { name: /register/i })).toBeInTheDocument();
  });
});
