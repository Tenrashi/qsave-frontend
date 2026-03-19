import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import {
  renderWithProviders,
  screen,
  waitFor,
  setupUser,
} from "@/test/test-utils";
import { Dialog } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { SYNC_STATUS, RECORD_STATUS } from "@/domain/types";
import type { SyncRecord } from "@/domain/types";
import { sims4Game } from "@/test/mocks/games";
import { mockBackups } from "@/test/mocks/drive";
import { RestoreContent } from "./RestoreContent";

const defaultRestoreRecord: SyncRecord = {
  id: "r1",
  gameName: "The Sims 4",
  fileName: "The Sims 4.zip",
  syncedAt: new Date(),
  driveFileId: "b1",
  revisionCount: 3,
  status: RECORD_STATUS.success,
  type: "restore",
};

const { mockListGameBackups, mockRestoreGame } = vi.hoisted(() => ({
  mockListGameBackups: vi.fn(),
  mockRestoreGame: vi.fn(),
}));

vi.mock("@/services/drive/drive", () => ({
  listGameBackups: mockListGameBackups,
}));

vi.mock("@/services/restore/restore", () => ({
  restoreGame: mockRestoreGame,
}));

const renderContent = (props: { quick?: boolean } = {}) =>
  renderWithProviders(
    <Dialog open={true}>
      <RestoreContent game={sims4Game} open={true} {...props} />
    </Dialog>,
  );

describe("RestoreContent", () => {
  const user = setupUser();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRestoreGame.mockResolvedValue(defaultRestoreRecord);
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

  it("shows backup list when opened without quick mode", async () => {
    renderContent();

    await waitFor(() => {
      expect(screen.queryByText("restore.selectBackup")).toBeInTheDocument();
    });
  });

  it("shows confirmation directly in quick mode without loading", () => {
    renderContent({ quick: true });

    expect(screen.getByText("restore.confirmTitle")).toBeInTheDocument();
    expect(screen.getByText("restore.warning")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("shows restore button in quick mode", () => {
    renderContent({ quick: true });

    expect(
      screen.getByRole("button", { name: "restore.restore" }),
    ).toBeInTheDocument();
  });

  it("shows no backups message when list is empty", async () => {
    mockListGameBackups.mockResolvedValueOnce([]);

    renderContent();

    await waitFor(() => {
      expect(screen.getByText("restore.noBackups")).toBeInTheDocument();
    });
  });

  it("shows backup items in list mode", async () => {
    renderContent();

    await waitFor(() => {
      expect(screen.getAllByRole("button").length).toBeGreaterThan(1);
    });
  });

  it("does not show restore button before selecting a backup in list mode", async () => {
    renderContent();

    await waitFor(() => {
      expect(screen.queryByText("restore.selectBackup")).toBeInTheDocument();
    });

    // In list mode without selection, restore button should not be present
    expect(
      screen.queryByRole("button", { name: "restore.restore" }),
    ).not.toBeInTheDocument();
  });

  it("shows close button in list mode", async () => {
    renderContent();

    await waitFor(() => {
      expect(screen.queryByText("restore.selectBackup")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "restore.close" }),
    ).toBeInTheDocument();
  });

  it("shows success state after successful restore in quick mode", async () => {
    renderContent({ quick: true });

    const restoreBtn = screen.getByRole("button", { name: "restore.restore" });
    await user.click(restoreBtn);

    await waitFor(() => {
      expect(screen.getByText("restore.success")).toBeInTheDocument();
    });
  });

  it("shows error state when restore fails in quick mode", async () => {
    mockRestoreGame.mockResolvedValueOnce({
      ...defaultRestoreRecord,
      revisionCount: 0,
      status: RECORD_STATUS.error,
      error: "Extraction failed",
    });

    renderContent({ quick: true });

    const restoreBtn = screen.getByRole("button", { name: "restore.restore" });
    await user.click(restoreBtn);

    await waitFor(() => {
      expect(screen.getByText("Extraction failed")).toBeInTheDocument();
    });
  });

  it("sets restoring status during restore", async () => {
    let resolveRestore: (value: SyncRecord) => void;
    mockRestoreGame.mockReturnValueOnce(
      new Promise<SyncRecord>((resolve) => {
        resolveRestore = resolve;
      }),
    );

    renderContent({ quick: true });

    const restoreBtn = screen.getByRole("button", { name: "restore.restore" });
    await user.click(restoreBtn);

    await waitFor(() => {
      expect(screen.getByText("restore.restoring")).toBeInTheDocument();
    });

    await act(() => {
      resolveRestore!(defaultRestoreRecord);
    });
  });

  it("sets error game status when restore mutation fails", async () => {
    mockRestoreGame.mockRejectedValueOnce(new Error("Network error"));

    renderContent({ quick: true });

    const restoreBtn = screen.getByRole("button", { name: "restore.restore" });
    await user.click(restoreBtn);

    await waitFor(() => {
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      );
    });
  });

  it("shows error when backup query fails", async () => {
    mockListGameBackups.mockRejectedValueOnce(new Error("Drive error"));

    renderContent();

    await waitFor(() => {
      expect(screen.getByText("Drive error")).toBeInTheDocument();
    });
  });
});
