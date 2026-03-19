import { describe, it, expect, beforeEach, vi } from "vitest";
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
import {
  sims4Game,
  eldenRingGame,
  manualGame,
  emptyManualGame,
} from "@/test/mocks/games";
import { computeGameHash } from "@/lib/hash/hash";
import { GameCard, type GameCardProps } from "./GameCard";

const { mockSyncGame, mockRemoveManualGame } = vi.hoisted(() => ({
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
}));

vi.mock("./utils/formatSize", () => ({
  formatSize: (bytes: number) => `${bytes} bytes`,
}));

vi.mock("@/services/sync/sync", () => ({
  syncGame: mockSyncGame,
}));

vi.mock("@/lib/store/store", () => ({
  removeManualGame: mockRemoveManualGame,
  setWatchedGames: vi.fn(),
  setSyncFingerprint: vi.fn(),
}));

const defaultProps: GameCardProps = {
  game: sims4Game,
};

const renderGameCard = (overrides: Partial<GameCardProps> = {}) =>
  renderWithProviders(<GameCard {...defaultProps} {...overrides} />);

const authenticateUser = () => {
  useAuthStore.setState({
    auth: { isAuthenticated: true, email: "test@gmail.com" },
    loading: false,
  });
};

describe("GameCard", () => {
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

  it("renders game name and aggregated size", () => {
    renderGameCard();
    expect(screen.getByText("The Sims 4")).toBeInTheDocument();
    expect(screen.getByText("20971520 bytes")).toBeInTheDocument();
  });

  it("does not show sync button when not authenticated", () => {
    renderGameCard();
    expect(screen.queryByText("games.sync")).not.toBeInTheDocument();
  });

  it("shows sync button when authenticated", () => {
    authenticateUser();
    renderGameCard();
    expect(screen.getByText("games.sync")).toBeInTheDocument();
  });

  it("renders with custom game", () => {
    renderGameCard({ game: eldenRingGame });
    expect(screen.getByText("Elden Ring")).toBeInTheDocument();
  });

  it("shows watch toggle when authenticated", () => {
    authenticateUser();
    renderGameCard();
    expect(
      screen.getByRole("button", {
        name: /games\.watchTooltip|games\.unwatchTooltip/,
      }),
    ).toBeInTheDocument();
  });

  it("does not show watch toggle when not authenticated", () => {
    renderGameCard();
    expect(
      screen.queryByRole("button", {
        name: /games\.watchTooltip|games\.unwatchTooltip/,
      }),
    ).not.toBeInTheDocument();
  });

  it("toggles watch state when clicking the eye icon", async () => {
    authenticateUser();
    renderGameCard();

    const toggle = screen.getByRole("button", {
      name: /games\.watchTooltip|games\.unwatchTooltip/,
    });
    await user.click(toggle);

    expect(useSyncStore.getState().watchedGames["The Sims 4"]).toBe(true);
  });

  it("shows green checkmark when game is synced", () => {
    authenticateUser();
    const hash = computeGameHash(sims4Game.saveFiles);
    useSyncStore.setState({
      syncFingerprints: {
        "The Sims 4": { hash, syncedAt: new Date().toISOString() },
      },
    });

    renderGameCard();
    expect(screen.getByRole("img", { name: "synced" })).toBeInTheDocument();
  });

  it("does not show checkmark when game has unsynced changes", () => {
    authenticateUser();
    useSyncStore.setState({
      syncFingerprints: {
        "The Sims 4": {
          hash: "stale-hash",
          syncedAt: new Date().toISOString(),
        },
      },
    });

    renderGameCard();
    expect(
      screen.queryByRole("img", { name: "synced" }),
    ).not.toBeInTheDocument();
  });

  it("shows custom badge for manual games", () => {
    renderGameCard({ game: manualGame });
    expect(screen.getByText("games.manualBadge")).toBeInTheDocument();
  });

  it("does not show custom badge for auto-detected games", () => {
    renderGameCard();
    expect(screen.queryByText("games.manualBadge")).not.toBeInTheDocument();
  });

  it("shows remove button for manual games", () => {
    renderGameCard({ game: manualGame });
    expect(
      screen.getByRole("button", { name: "games.removeGame" }),
    ).toBeInTheDocument();
  });

  it("does not show remove button for auto-detected games", () => {
    renderGameCard();
    expect(
      screen.queryByRole("button", { name: "games.removeGame" }),
    ).not.toBeInTheDocument();
  });

  it("opens confirmation dialog when remove button is clicked", async () => {
    renderGameCard({ game: manualGame });
    await user.click(screen.getByRole("button", { name: "games.removeGame" }));
    expect(screen.getByText("games.removeConfirmTitle")).toBeInTheDocument();
    expect(
      screen.getByText("games.removeConfirmDescription"),
    ).toBeInTheDocument();
  });

  it("shows restore buttons when game has backup", () => {
    authenticateUser();
    useSyncStore.setState({
      gameStatuses: {},
      watchedGames: {},
      syncFingerprints: {},
      backedUpGames: new Set(["The Sims 4"]),
      backedUpGamesLoaded: true,
    });
    renderGameCard();
    expect(
      screen.getByRole("button", { name: "restore.tooltip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "restore.tooltipPick" }),
    ).toBeInTheDocument();
  });

  it("does not show restore buttons when game has no backup", () => {
    authenticateUser();
    renderGameCard();
    expect(
      screen.queryByRole("button", { name: "restore.tooltip" }),
    ).not.toBeInTheDocument();
  });

  it("hides last modified date when game has no save files", () => {
    renderGameCard({ game: emptyManualGame });
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
  });

  it("syncs game and updates status on success", async () => {
    authenticateUser();
    renderGameCard();

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

    renderGameCard();
    await user.click(screen.getByText("games.sync"));

    await waitFor(() => {
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      );
    });
  });

  it("sets error status when sync throws", async () => {
    authenticateUser();
    mockSyncGame.mockRejectedValueOnce(new Error("network error"));

    renderGameCard();
    await user.click(screen.getByText("games.sync"));

    await waitFor(() => {
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      );
    });
  });

  it("shows syncing spinner during sync", async () => {
    authenticateUser();
    useSyncStore.setState({
      gameStatuses: { "The Sims 4": SYNC_STATUS.syncing },
    });

    renderGameCard();
    expect(screen.getByRole("img", { name: "syncing" })).toBeInTheDocument();
  });

  it("shows restoring spinner when restoring", () => {
    authenticateUser();
    useSyncStore.setState({
      gameStatuses: { "The Sims 4": SYNC_STATUS.restoring },
    });

    renderGameCard();
    expect(screen.getByRole("img", { name: "restoring" })).toBeInTheDocument();
  });

  it("shows error icon on sync error status", () => {
    authenticateUser();
    useSyncStore.setState({
      gameStatuses: { "The Sims 4": SYNC_STATUS.error },
    });

    renderGameCard();
    expect(screen.getByRole("img", { name: "sync error" })).toBeInTheDocument();
  });
});
