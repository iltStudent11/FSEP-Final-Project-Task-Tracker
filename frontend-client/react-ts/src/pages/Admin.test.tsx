import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Admin from "./Admin";
import type { User } from "../types";
import api from "../api";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

const users: User[] = [
  {
    _id: "u-admin",
    name: "Admin User",
    email: "admin@tasktracker.com",
    role: "admin",
    createdAt: new Date("2026-01-01").toISOString(),
  },
];

describe("Admin page — backup & restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === "/auth/users") {
        return { data: { users } };
      }
      return { data: {} };
    });
  });

  it("downloads a backup file when the button is clicked", async () => {
    const blob = new Blob(['{"version":1}'], { type: "application/json" });
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === "/auth/users") return { data: { users } };
      if (url === "/admin/backup") {
        return {
          data: blob,
          headers: { "content-disposition": 'attachment; filename="task-tracker-backup-2026-09-22.json"' },
        };
      }
      return { data: {} };
    });

    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const user = userEvent.setup();
    render(<Admin />);

    await screen.findByText("Admin User");
    await user.click(screen.getByRole("button", { name: /download backup/i }));

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith("/admin/backup", { responseType: "blob" });
    });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("only enables the restore button once RESTORE is typed", async () => {
    const user = userEvent.setup();
    render(<Admin />);

    await screen.findByText("Admin User");

    const file = new File(
      [JSON.stringify({ version: 1, users: [], projects: [], tasks: [] })],
      "backup.json",
      { type: "application/json" },
    );
    const fileInput = document.getElementById("restore-file") as HTMLInputElement;
    await user.upload(fileInput, file);

    const restoreButton = await screen.findByRole("button", { name: /restore database/i });
    expect(restoreButton).toBeDisabled();

    const confirmInput = screen.getByLabelText(/type restore to confirm/i);
    await user.type(confirmInput, "nope");
    expect(restoreButton).toBeDisabled();

    await user.clear(confirmInput);
    await user.type(confirmInput, "RESTORE");
    expect(restoreButton).toBeEnabled();
  });

  it("uploads the parsed backup JSON and shows the result counts", async () => {
    mockedApi.post.mockResolvedValue({
      data: { message: "Restore complete", counts: { users: 2, projects: 1, tasks: 3 } },
    });

    const user = userEvent.setup();
    render(<Admin />);

    await screen.findByText("Admin User");

    const backupPayload = { version: 1, users: [{ email: "a@example.com" }], projects: [], tasks: [] };
    const file = new File([JSON.stringify(backupPayload)], "backup.json", {
      type: "application/json",
    });
    const fileInput = document.getElementById("restore-file") as HTMLInputElement;
    await user.upload(fileInput, file);

    const confirmInput = screen.getByLabelText(/type restore to confirm/i);
    await user.type(confirmInput, "RESTORE");

    await user.click(screen.getByRole("button", { name: /restore database/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/admin/restore", backupPayload);
    });
    expect(await screen.findByText(/restored 2 user\(s\), 1 project\(s\), and 3 task\(s\)/i)).toBeInTheDocument();
  });

  it("shows an error instead of calling the API when the file isn't valid JSON", async () => {
    const user = userEvent.setup();
    render(<Admin />);

    await screen.findByText("Admin User");

    const file = new File(["not json"], "backup.json", { type: "application/json" });
    const fileInput = document.getElementById("restore-file") as HTMLInputElement;
    await user.upload(fileInput, file);

    const confirmInput = screen.getByLabelText(/type restore to confirm/i);
    await user.type(confirmInput, "RESTORE");
    await user.click(screen.getByRole("button", { name: /restore database/i }));

    expect(await screen.findByText(/valid json/i)).toBeInTheDocument();
    expect(mockedApi.post).not.toHaveBeenCalled();
  });
});
