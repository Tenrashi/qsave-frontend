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
import { sims4Game, cloudOnlyGame } from "@/test/mocks/games";
import { mockBackups } from "@/test/mocks/drive";
import { RestoreBody } from "./RestoreBody";

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

const {
  mockListGameBackups,
  mockRestoreGame,
  mockDeleteGameBackup,
  mockInvoke,
} = vi.hoisted(() => ({
  mockListGameBackups: vi.fn(),
  mockRestoreGame: vi.fn(),
  mockDeleteGameBackup: vi.fn(),
  mockInvoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@/services/drive/drive", () => ({
  listGameBackups: mockListGameBackups,
  deleteGameBackup: mockDeleteGameBackup,
}));

vi.mock("@/services/restore/restore", () => ({
  restoreGame: mockRestoreGame,
}));

vi.mock("@/components/ui/status-message", () => ({
  StatusMessage: ({
    variant,
    message,
  }: {
    variant: string;
    message: string;
  }) => <div data-testid={`status-${variant}`}>{message}</div>,
}));

vi.mock("./QuickWarning/QuickWarning", () => ({
  QuickWarning: () => <div data-testid="quick-warning" />,
}));

vi.mock("./BackupsSkeleton/BackupsSkeleton", () => ({
  BackupsSkeleton: () => <div data-testid="backups-skeleton" />,
}));

vi.mock("./EmptyBackups/EmptyBackups", () => ({
  EmptyBackups: () => <div data-testid="empty-backups" />,
}));

vi.mock("./BackupList/BackupList", () => ({
  BackupList: ({
    onDelete,
    backups,
  }: {
    onDelete: (backupId: string) => void;
    backups: { id: string }[];
  }) => (
    <div data-testid="backup-list">
      {backups.map((backup) => (
        <button
          key={backup.id}
          type="button"
          onClick={() => onDelete(backup.id)}
          aria-label="delete-backup"
        >
          delete {backup.id}
        </button>
      ))}
    </div>
  ),
}));

const renderBody = (
  props: { quick?: boolean; game?: typeof sims4Game } = {},
) => {
  const { game = sims4Game, ...rest } = props;
  return renderWithProviders(
    <Dialog open={true}>
      <RestoreBody game={game} open={true} {...rest} />
    </Dialog>,
  );
};

describe("RestoreBody", () => {
  const user = setupUser();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRestoreGame.mockResolvedValue(defaultRestoreRecord);
    mockListGameBackups.mockResolvedValue(mockBackups);
    mockDeleteGameBackup.mockResolvedValue(undefined);
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
    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId("backup-list")).toBeInTheDocument();
    });
  });

  it("shows quick warning in quick mode", () => {
    renderBody({ quick: true });
    expect(screen.getByTestId("quick-warning")).toBeInTheDocument();
  });

  it("shows restore button in quick mode", () => {
    renderBody({ quick: true });
    expect(
      screen.getByRole("button", { name: "restore.restore" }),
    ).toBeInTheDocument();
  });

  it("shows empty backups when list is empty", async () => {
    mockListGameBackups.mockResolvedValueOnce([]);
    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId("empty-backups")).toBeInTheDocument();
    });
  });

  it("does not show restore button before selecting a backup in list mode", async () => {
    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId("backup-list")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: "restore.restore" }),
    ).not.toBeInTheDocument();
  });

  it("shows close button", async () => {
    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId("backup-list")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "restore.close" }),
    ).toBeInTheDocument();
  });

  it("shows pending status during restore", async () => {
    let resolveRestore: (value: SyncRecord) => void;
    mockRestoreGame.mockReturnValueOnce(
      new Promise<SyncRecord>((resolve) => {
        resolveRestore = resolve;
      }),
    );

    renderBody({ quick: true });

    await user.click(screen.getByRole("button", { name: "restore.restore" }));

    await waitFor(() => {
      expect(screen.getByTestId("status-pending")).toBeInTheDocument();
      expect(screen.getByTestId("status-pending")).toHaveTextContent(
        "restore.restoring",
      );
    });

    await act(() => {
      resolveRestore!(defaultRestoreRecord);
    });
  });

  it("shows success status after successful restore", async () => {
    renderBody({ quick: true });

    await user.click(screen.getByRole("button", { name: "restore.restore" }));

    await waitFor(() => {
      expect(screen.getByTestId("status-success")).toBeInTheDocument();
      expect(screen.getByTestId("status-success")).toHaveTextContent(
        "restore.success",
      );
    });
  });

  it("shows error status when restore fails with error result", async () => {
    mockRestoreGame.mockResolvedValueOnce({
      ...defaultRestoreRecord,
      revisionCount: 0,
      status: RECORD_STATUS.error,
      error: "Extraction failed",
    });

    renderBody({ quick: true });

    await user.click(screen.getByRole("button", { name: "restore.restore" }));

    await waitFor(() => {
      expect(screen.getByTestId("status-error")).toBeInTheDocument();
      expect(screen.getByTestId("status-error")).toHaveTextContent(
        "Extraction failed",
      );
    });
  });

  it("sets error game status when restore mutation throws", async () => {
    mockRestoreGame.mockRejectedValueOnce(new Error("Network error"));

    renderBody({ quick: true });

    await user.click(screen.getByRole("button", { name: "restore.restore" }));

    await waitFor(() => {
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      );
    });
  });

  it("shows error status when backup query fails", async () => {
    mockListGameBackups.mockRejectedValueOnce(new Error("Drive error"));
    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId("status-error")).toBeInTheDocument();
      expect(screen.getByTestId("status-error")).toHaveTextContent(
        "Drive error",
      );
    });
  });

  it("shows skeleton while loading backups", () => {
    mockListGameBackups.mockReturnValueOnce(new Promise(() => {}));
    renderBody();

    expect(screen.getByTestId("backups-skeleton")).toBeInTheDocument();
  });

  it("calls deleteGameBackup when delete is triggered", async () => {
    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId("backup-list")).toBeInTheDocument();
    });

    await user.click(screen.getAllByLabelText("delete-backup")[0]);

    await waitFor(() => {
      expect(mockDeleteGameBackup).toHaveBeenCalledWith("b1");
    });
  });

  it("shows success status after deleting a backup", async () => {
    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId("backup-list")).toBeInTheDocument();
    });

    await user.click(screen.getAllByLabelText("delete-backup")[0]);

    await waitFor(() => {
      expect(screen.getByTestId("status-success")).toBeInTheDocument();
      expect(screen.getByTestId("status-success")).toHaveTextContent(
        "restore.deleteSuccess",
      );
    });
  });

  it("shows error status when delete fails", async () => {
    mockDeleteGameBackup.mockRejectedValueOnce(new Error("Permission denied"));
    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId("backup-list")).toBeInTheDocument();
    });

    await user.click(screen.getAllByLabelText("delete-backup")[0]);

    await waitFor(() => {
      expect(screen.getByTestId("status-error")).toBeInTheDocument();
      expect(screen.getByTestId("status-error")).toHaveTextContent(
        "Permission denied",
      );
    });
  });

  describe("cloud-only games", () => {
    it("shows folder picker for cloud-only games", async () => {
      renderBody({ game: cloudOnlyGame });

      await waitFor(() => {
        expect(screen.getByText("restore.pickFolder")).toBeInTheDocument();
      });
    });

    it("does not show folder picker for local games", () => {
      renderBody();
      expect(screen.queryByText("restore.pickFolder")).not.toBeInTheDocument();
    });

    it("shows selected path after picking a folder", async () => {
      mockInvoke.mockResolvedValueOnce("/Users/test/saves");
      renderBody({ game: cloudOnlyGame });

      await user.click(screen.getByText("restore.pickFolder"));

      await waitFor(() => {
        expect(screen.getByText("/Users/test/saves")).toBeInTheDocument();
        expect(screen.getByText("restore.changePath")).toBeInTheDocument();
      });
    });

    it("does not show restore button before picking a folder", async () => {
      renderBody({ game: cloudOnlyGame });

      await waitFor(() => {
        expect(screen.getByTestId("backup-list")).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("button", { name: "restore.restore" }),
      ).not.toBeInTheDocument();
    });
  });
});
