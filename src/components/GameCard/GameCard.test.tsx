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
  steamCloudGame,
  gogGame,
  epicGame,
} from "@/test/mocks/games";
import { GameCard, type GameCardProps } from "./GameCard";

vi.mock("./utils/formatSize", () => ({
  formatSize: (bytes: number) => `${bytes} bytes`,
}));

vi.mock("@/operations/sync/sync/sync", () => ({
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

  it("shows green checkmark when game has backup", () => {
    useSyncStore.setState({
      backedUpGames: new Set(["The Sims 4"]),
    });

    renderGameCard();
    expect(screen.getByRole("img", { name: "synced" })).toBeInTheDocument();
  });

  it("shows green checkmark when game sync succeeded", () => {
    useSyncStore.setState({
      gameStatuses: { "The Sims 4": SYNC_STATUS.success },
    });

    renderGameCard();
    expect(screen.getByRole("img", { name: "synced" })).toBeInTheDocument();
  });

  it("does not show checkmark when game has no backup and is idle", () => {
    useSyncStore.setState({
      backedUpGames: new Set(),
      gameStatuses: {},
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

  describe("platform badge", () => {
    it("shows Steam badge for Steam platform games", () => {
      renderGameCard({ game: steamCloudGame });
      expect(screen.getByText("games.platformSteam")).toBeInTheDocument();
    });

    it("shows GOG badge for GOG platform games", () => {
      renderGameCard({ game: gogGame });
      expect(screen.getByText("games.platformGog")).toBeInTheDocument();
    });

    it("shows Epic badge for Epic platform games", () => {
      renderGameCard({ game: epicGame });
      expect(screen.getByText("games.platformEpic")).toBeInTheDocument();
    });

    it("does not show platform badge when platform is not set", () => {
      renderGameCard({ game: sims4Game });
      expect(screen.queryByText("games.platformSteam")).not.toBeInTheDocument();
      expect(screen.queryByText("games.platformGog")).not.toBeInTheDocument();
      expect(screen.queryByText("games.platformEpic")).not.toBeInTheDocument();
    });
  });

  describe("steam cloud games", () => {
    it("shows steam cloud badge for games with Steam Cloud", () => {
      renderGameCard({ game: steamCloudGame });
      expect(screen.getByText("games.steamCloudBadge")).toBeInTheDocument();
    });

    it("does not show steam cloud badge for games without Steam Cloud", () => {
      renderGameCard();
      expect(
        screen.queryByText("games.steamCloudBadge"),
      ).not.toBeInTheDocument();
    });
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
