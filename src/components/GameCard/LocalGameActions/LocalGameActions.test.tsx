import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  renderWithProviders,
  screen,
  setupUser,
  waitFor,
} from "@/test/test-utils";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { SYNC_STATUS, RECORD_STATUS } from "@/domain/types";
import type { SyncRecord } from "@/domain/types";
import { sims4Game, manualGame } from "@/test/mocks/games";
import { LocalGameActions } from "./LocalGameActions";

const {
  mockSyncGame,
  mockRemoveManualGame,
  mockGetCloudGameHash,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockSyncGame: vi.fn(() =>
    Promise.resolve({
      id: "sync-1",
      gameName: "The Sims 4",
      fileName: "The Sims 4.zip",
      syncedAt: new Date(),
      driveFileId: "file-123",
      revisionCount: 1,
      status: RECORD_STATUS.success,
      contentHash: "hash-abc",
    } as SyncRecord),
  ),
  mockRemoveManualGame: vi.fn(),
  mockGetCloudGameHash: vi.fn(() =>
    Promise.resolve(null as { hash: string; syncedAt: string } | null),
  ),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("../utils/formatSize", () => ({
  formatSize: (bytes: number) => `${bytes} bytes`,
}));

vi.mock("@/operations/sync/sync/sync", () => ({
  syncGame: mockSyncGame,
}));

vi.mock("@/lib/store/store", () => ({
  removeManualGame: mockRemoveManualGame,
  setWatchedGames: vi.fn(),
  setSyncFingerprint: vi.fn(),
}));

vi.mock("@/operations/devices/devices", () => ({
  getCloudGameHash: mockGetCloudGameHash,
}));

const renderActions = (game = sims4Game) =>
  renderWithProviders(<LocalGameActions game={game} />);

const authenticateUser = () => {
  useAuthStore.setState({
    auth: { isAuthenticated: true, email: "test@gmail.com" },
    loading: false,
  });
};

describe("LocalGameActions", () => {
  const user = setupUser();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ auth: { isAuthenticated: false }, loading: false });
    useSyncStore.setState({
      gameStatuses: {},
      watchedGames: {},
      syncFingerprints: {},
      backedUpGames: new Set<string>(),
      backedUpGamesLoaded: false,
    });
  });

  it("renders file size", () => {
    renderActions();
    expect(screen.getByText("20971520 bytes")).toBeInTheDocument();
  });

  it("renders last modified date when save files exist", () => {
    renderActions();
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it("does not show sync button when not authenticated", () => {
    renderActions();
    expect(screen.queryByText("games.sync")).not.toBeInTheDocument();
  });

  it("shows sync button when authenticated", () => {
    authenticateUser();
    renderActions();
    expect(screen.getByText("games.sync")).toBeInTheDocument();
  });

  // TODO: autosync is WIP — uncomment when re-enabling
  // it("shows watch toggle when authenticated", () => {
  //   authenticateUser();
  //   renderActions();
  //   expect(
  //     screen.getByRole("button", {
  //       name: /games\.watchTooltip|games\.unwatchTooltip/,
  //     }),
  //   ).toBeInTheDocument();
  // });

  // it("toggles watch state when clicking the eye icon", async () => {
  //   authenticateUser();
  //   renderActions();

  //   const toggle = screen.getByRole("button", {
  //     name: /games\.watchTooltip|games\.unwatchTooltip/,
  //   });
  //   await user.click(toggle);

  //   expect(useSyncStore.getState().watchedGames["The Sims 4"]).toBe(true);
  // });

  it("shows remove button for manual games", () => {
    renderActions(manualGame);
    expect(
      screen.getByRole("button", { name: "games.removeGame" }),
    ).toBeInTheDocument();
  });

  it("does not show remove button for auto-detected games", () => {
    renderActions();
    expect(
      screen.queryByRole("button", { name: "games.removeGame" }),
    ).not.toBeInTheDocument();
  });

  it("opens confirmation dialog when remove button is clicked", async () => {
    renderActions(manualGame);
    await user.click(screen.getByRole("button", { name: "games.removeGame" }));
    expect(screen.getByText("games.removeConfirmTitle")).toBeInTheDocument();
    expect(
      screen.getByText("games.removeConfirmDescription"),
    ).toBeInTheDocument();
  });

  it("removes game and shows success toast on confirm", async () => {
    mockRemoveManualGame.mockResolvedValueOnce(undefined);
    renderActions(manualGame);
    await user.click(screen.getByRole("button", { name: "games.removeGame" }));
    await user.click(screen.getByText("games.remove"));

    await waitFor(() => {
      expect(mockRemoveManualGame).toHaveBeenCalledWith(manualGame.name);
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("toast.removeGameSuccess");
  });

  it("shows error toast when remove fails", async () => {
    mockRemoveManualGame.mockRejectedValueOnce(new Error("fail"));
    renderActions(manualGame);
    await user.click(screen.getByRole("button", { name: "games.removeGame" }));
    await user.click(screen.getByText("games.remove"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("toast.removeGameFailed");
    });
  });

  it("shows restore buttons when game has backup", () => {
    authenticateUser();
    useSyncStore.setState({
      backedUpGames: new Set(["The Sims 4"]),
      backedUpGamesLoaded: true,
    });
    renderActions();
    expect(
      screen.getByRole("button", { name: "restore.tooltip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "restore.tooltipPick" }),
    ).toBeInTheDocument();
  });

  it("does not show restore buttons when game has no backup", () => {
    authenticateUser();
    renderActions();
    expect(
      screen.queryByRole("button", { name: "restore.tooltip" }),
    ).not.toBeInTheDocument();
  });

  it("disables sync and restore buttons when busy", () => {
    authenticateUser();
    useSyncStore.setState({
      gameStatuses: { "The Sims 4": SYNC_STATUS.syncing },
      backedUpGames: new Set(["The Sims 4"]),
      backedUpGamesLoaded: true,
    });
    renderActions();
    expect(screen.getByText("games.sync").closest("button")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "restore.tooltip" }),
    ).toBeDisabled();
  });

  it("syncs game, updates status, and shows success toast", async () => {
    authenticateUser();
    renderActions();

    await user.click(screen.getByText("games.sync"));

    await waitFor(() => expect(mockSyncGame).toHaveBeenCalledWith(sims4Game));
    expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
      SYNC_STATUS.success,
    );
    expect(mockToastSuccess).toHaveBeenCalledWith("toast.syncSuccess");
  });

  it("sets error status and shows error toast when sync returns error record", async () => {
    authenticateUser();
    mockSyncGame.mockResolvedValueOnce({
      status: RECORD_STATUS.error,
      error: "upload failed",
    } as SyncRecord);

    renderActions();
    await user.click(screen.getByText("games.sync"));

    await waitFor(() =>
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      ),
    );
    expect(mockToastError).toHaveBeenCalledWith("toast.syncFailed");
  });

  it("sets error status and shows error toast when sync throws", async () => {
    authenticateUser();
    mockSyncGame.mockRejectedValueOnce(new Error("network error"));

    renderActions();
    await user.click(screen.getByText("games.sync"));

    await waitFor(() =>
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      ),
    );
    expect(mockToastError).toHaveBeenCalledWith("toast.syncFailed");
  });

  describe("upload-side conflict detection", () => {
    it("shows conflict dialog when cloud has newer backup", async () => {
      authenticateUser();
      mockGetCloudGameHash.mockResolvedValue({
        hash: "hash-cloud",
        syncedAt: "2026-03-14T12:00:00Z",
      });
      useSyncStore.setState({
        syncFingerprints: {
          "The Sims 4": {
            hash: "hash-old",
            syncedAt: "2026-03-13T12:00:00Z",
          },
        },
      });

      renderActions();
      await user.click(screen.getByText("games.sync"));

      await waitFor(() => {
        expect(screen.getByText("sync.conflictTitle")).toBeInTheDocument();
      });
      expect(mockSyncGame).not.toHaveBeenCalled();
    });

    it("syncs directly when no fingerprint exists", async () => {
      authenticateUser();
      useSyncStore.setState({ syncFingerprints: {} });

      renderActions();
      await user.click(screen.getByText("games.sync"));

      await waitFor(() => {
        expect(mockSyncGame).toHaveBeenCalledWith(sims4Game);
      });
    });

    it("syncs directly when cloud hash matches fingerprint", async () => {
      authenticateUser();
      mockGetCloudGameHash.mockResolvedValue({
        hash: "hash-same",
        syncedAt: "2026-03-14T12:00:00Z",
      });
      useSyncStore.setState({
        syncFingerprints: {
          "The Sims 4": {
            hash: "hash-same",
            syncedAt: "2026-03-13T12:00:00Z",
          },
        },
      });

      renderActions();
      await user.click(screen.getByText("games.sync"));

      await waitFor(() => {
        expect(mockSyncGame).toHaveBeenCalledWith(sims4Game);
      });
    });

    it("syncs directly when no cloud hash exists", async () => {
      authenticateUser();
      mockGetCloudGameHash.mockResolvedValue(null);
      useSyncStore.setState({
        syncFingerprints: {
          "The Sims 4": {
            hash: "hash-old",
            syncedAt: "2026-03-13T12:00:00Z",
          },
        },
      });

      renderActions();
      await user.click(screen.getByText("games.sync"));

      await waitFor(() => {
        expect(mockSyncGame).toHaveBeenCalledWith(sims4Game);
      });
    });

    it("proceeds with sync when conflict check fails", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      authenticateUser();
      mockGetCloudGameHash.mockRejectedValueOnce(new Error("network error"));
      useSyncStore.setState({
        syncFingerprints: {
          "The Sims 4": {
            hash: "hash-old",
            syncedAt: "2026-03-13T12:00:00Z",
          },
        },
      });

      renderActions();
      await user.click(screen.getByText("games.sync"));

      await waitFor(() => {
        expect(mockSyncGame).toHaveBeenCalledWith(sims4Game);
      });
      expect(warnSpy).toHaveBeenCalledWith(
        "Conflict check failed, proceeding with sync:",
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });

    it("closes conflict dialog and does not sync when download cloud is clicked", async () => {
      authenticateUser();
      mockGetCloudGameHash.mockResolvedValue({
        hash: "hash-cloud",
        syncedAt: "2026-03-14T12:00:00Z",
      });
      useSyncStore.setState({
        syncFingerprints: {
          "The Sims 4": {
            hash: "hash-old",
            syncedAt: "2026-03-13T12:00:00Z",
          },
        },
        backedUpGames: new Set(["The Sims 4"]),
        backedUpGamesLoaded: true,
      });

      renderActions();
      await user.click(screen.getByText("games.sync"));

      await waitFor(() => {
        expect(screen.getByText("sync.conflictTitle")).toBeInTheDocument();
      });

      await user.click(screen.getByText("sync.downloadCloud"));

      await waitFor(() => {
        expect(
          screen.queryByText("sync.conflictTitle"),
        ).not.toBeInTheDocument();
      });
      expect(mockSyncGame).not.toHaveBeenCalled();
    });

    it("syncs when upload anyway is clicked after conflict", async () => {
      authenticateUser();
      mockGetCloudGameHash.mockResolvedValue({
        hash: "hash-cloud",
        syncedAt: "2026-03-14T12:00:00Z",
      });
      useSyncStore.setState({
        syncFingerprints: {
          "The Sims 4": {
            hash: "hash-old",
            syncedAt: "2026-03-13T12:00:00Z",
          },
        },
      });

      renderActions();
      await user.click(screen.getByText("games.sync"));

      await waitFor(() => {
        expect(screen.getByText("sync.conflictTitle")).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: "sync.uploadAnyway" }),
      );

      await waitFor(() => {
        expect(mockSyncGame).toHaveBeenCalledWith(sims4Game);
      });
    });
  });
});
