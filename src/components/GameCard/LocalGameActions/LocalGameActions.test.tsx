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

const { mockSyncGame, mockRemoveManualGame, mockComputeGameHash } = vi.hoisted(
  () => ({
    mockSyncGame: vi.fn(() =>
      Promise.resolve({
        id: "sync-1",
        gameName: "The Sims 4",
        fileName: "The Sims 4.zip",
        syncedAt: new Date(),
        driveFileId: "file-123",
        revisionCount: 1,
        status: RECORD_STATUS.success,
      } as SyncRecord),
    ),
    mockRemoveManualGame: vi.fn(),
    mockComputeGameHash: vi.fn(() => "mock-hash"),
  }),
);

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

vi.mock("@/lib/hash/hash", () => ({
  computeGameHash: mockComputeGameHash,
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

  it("syncs game and updates status on success", async () => {
    authenticateUser();
    renderActions();

    await user.click(screen.getByText("games.sync"));

    await waitFor(() => {
      expect(mockSyncGame).toHaveBeenCalledWith(sims4Game);
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.success,
      );
    });
  });

  it("sets error status when sync returns error record", async () => {
    authenticateUser();
    mockSyncGame.mockResolvedValueOnce({
      status: RECORD_STATUS.error,
      error: "upload failed",
    } as SyncRecord);

    renderActions();
    await user.click(screen.getByText("games.sync"));

    await waitFor(() => {
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      );
    });
  });

  it("disables sync button when saves are unchanged", () => {
    authenticateUser();
    useSyncStore.setState({
      syncFingerprints: {
        "The Sims 4": { hash: "mock-hash", syncedAt: new Date().toISOString() },
      },
      backedUpGames: new Set(["The Sims 4"]),
    });
    renderActions();
    expect(screen.getByText("games.sync").closest("button")).toBeDisabled();
  });

  it("enables sync button when saves have changed", () => {
    authenticateUser();
    useSyncStore.setState({
      syncFingerprints: {
        "The Sims 4": {
          hash: "stale-hash",
          syncedAt: new Date().toISOString(),
        },
      },
    });
    renderActions();
    expect(screen.getByText("games.sync").closest("button")).toBeEnabled();
  });

  it("sets error status when sync throws", async () => {
    authenticateUser();
    mockSyncGame.mockRejectedValueOnce(new Error("network error"));

    renderActions();
    await user.click(screen.getByText("games.sync"));

    await waitFor(() => {
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      );
    });
  });
});
