import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { SYNC_STATUS } from "@/domain/types";
import {
  sims4Game,
  eldenRingGame,
  manualGame,
  cloudOnlyGame,
} from "@/test/mocks/games";
import { computeGameHash } from "@/lib/hash/hash";
import { GameCard, type GameCardProps } from "./GameCard";

vi.mock("./utils/formatSize", () => ({
  formatSize: (bytes: number) => `${bytes} bytes`,
}));

vi.mock("@/services/sync/sync", () => ({
  syncGame: vi.fn(),
}));

vi.mock("@/lib/store/store", () => ({
  removeManualGame: vi.fn(),
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

  it("renders game name", () => {
    renderGameCard();
    expect(screen.getByText("The Sims 4")).toBeInTheDocument();
  });

  it("renders with custom game", () => {
    renderGameCard({ game: eldenRingGame });
    expect(screen.getByText("Elden Ring")).toBeInTheDocument();
  });

  it("shows green checkmark when game is synced", () => {
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

  it("shows syncing spinner during sync", () => {
    useSyncStore.setState({
      gameStatuses: { "The Sims 4": SYNC_STATUS.syncing },
    });

    renderGameCard();
    expect(screen.getByRole("img", { name: "syncing" })).toBeInTheDocument();
  });

  it("shows restoring spinner when restoring", () => {
    useSyncStore.setState({
      gameStatuses: { "The Sims 4": SYNC_STATUS.restoring },
    });

    renderGameCard();
    expect(screen.getByRole("img", { name: "restoring" })).toBeInTheDocument();
  });

  it("shows error icon on sync error status", () => {
    useSyncStore.setState({
      gameStatuses: { "The Sims 4": SYNC_STATUS.error },
    });

    renderGameCard();
    expect(screen.getByRole("img", { name: "sync error" })).toBeInTheDocument();
  });

  it("renders CloudOnlyActions for cloud-only games", () => {
    renderGameCard({ game: cloudOnlyGame });
    expect(screen.getByText("games.cloudOnlyHint")).toBeInTheDocument();
  });

  it("renders LocalGameActions for local games", () => {
    renderGameCard();
    expect(screen.getByText("20971520 bytes")).toBeInTheDocument();
  });

  describe("cloud-only games", () => {
    it("shows cloud badge for cloud-only games", () => {
      renderGameCard({ game: cloudOnlyGame });
      expect(screen.getByText("games.cloudBadge")).toBeInTheDocument();
    });

    it("does not show cloud badge for local games", () => {
      renderGameCard();
      expect(screen.queryByText("games.cloudBadge")).not.toBeInTheDocument();
    });

    it("does not show sync button for cloud-only games", () => {
      authenticateUser();
      renderGameCard({ game: cloudOnlyGame });
      expect(screen.queryByText("games.sync")).not.toBeInTheDocument();
    });

    it("does not show watch toggle for cloud-only games", () => {
      authenticateUser();
      renderGameCard({ game: cloudOnlyGame });
      expect(
        screen.queryByRole("button", {
          name: /games\.watchTooltip|games\.unwatchTooltip/,
        }),
      ).not.toBeInTheDocument();
    });
  });
});
