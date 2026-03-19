import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/test-utils";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { sims4Game } from "@/test/mocks/games";
import { mockBackups } from "@/test/mocks/drive";
import { Button } from "@/components/ui/button";
import { RestoreDialog } from "./RestoreDialog";

const { mockListGameBackups, mockDownloadBackup, mockRestoreGame } = vi.hoisted(() => ({
  mockListGameBackups: vi.fn(),
  mockDownloadBackup: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
  mockRestoreGame: vi.fn(() =>
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

vi.mock("@/services/drive/drive", () => ({
  listGameBackups: mockListGameBackups,
  downloadBackup: mockDownloadBackup,
}));

vi.mock("@/services/restore/restore", () => ({
  restoreGame: mockRestoreGame,
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
    vi.clearAllMocks();
    mockListGameBackups.mockResolvedValue(mockBackups);
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
    mockListGameBackups.mockResolvedValueOnce([]);

    renderRestoreDialog(false);
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(screen.getByText("restore.noBackups")).toBeInTheDocument();
    });
  });
});
