import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/test-utils";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { sims4Game } from "@/test/mocks/games";
import { Button } from "@/components/ui/button";
import { RestoreDialog } from "./RestoreDialog";

const mockBackups = [
  { id: "b1", name: "game_2026-03-14.zip", createdTime: "2026-03-14T12:00:00Z" },
  { id: "b2", name: "game_2026-03-13.zip", createdTime: "2026-03-13T12:00:00Z" },
];

vi.mock("@/services/drive/drive", () => ({
  listGameBackups: vi.fn(() => Promise.resolve(mockBackups)),
  downloadBackup: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
}));

vi.mock("@/services/restore/restore", () => ({
  restoreGame: vi.fn(() =>
    Promise.resolve({
      id: "r1",
      gameName: "The Sims 4",
      fileName: "The Sims 4.zip",
      syncedAt: new Date(),
      driveFileId: "b1",
      revisionCount: 3,
      status: "success",
      type: "restore",
    }),
  ),
}));

const renderRestoreDialog = (quick = false) =>
  renderWithProviders(
    <RestoreDialog
      game={sims4Game}
      trigger={<Button>Restore</Button>}
      quick={quick}
    />,
  );

describe("RestoreDialog", () => {
  beforeEach(() => {
    useAuthStore.setState({
      auth: { isAuthenticated: true, email: "test@gmail.com" },
      loading: false,
    });
    useSyncStore.setState({
      gameStatuses: {},
      syncFingerprints: {},
    });
  });

  it("does not show dialog initially", () => {
    renderRestoreDialog();
    expect(screen.queryByText("restore.title")).not.toBeInTheDocument();
  });

  it("shows backup list when opened without quick mode", async () => {
    renderRestoreDialog(false);
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(screen.queryByText("restore.selectBackup")).toBeInTheDocument();
    });
  });

  it("shows confirmation directly in quick mode without loading", async () => {
    renderRestoreDialog(true);
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(screen.getByText("restore.confirmTitle")).toBeInTheDocument();
    expect(screen.getByText("restore.warning")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("shows restore button in quick mode", async () => {
    renderRestoreDialog(true);
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(screen.getByRole("button", { name: "restore.restore" })).toBeInTheDocument();
  });

  it("shows no backups message when list is empty", async () => {
    const { listGameBackups } = await import("@/services/drive/drive");
    vi.mocked(listGameBackups).mockResolvedValueOnce([]);

    renderRestoreDialog(false);
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(screen.getByText("restore.noBackups")).toBeInTheDocument();
    });
  });
});
