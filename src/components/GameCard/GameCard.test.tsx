import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { sims4Game, eldenRingGame, manualGame, emptyManualGame } from "@/test/mocks/games";
import { computeGameHash } from "@/lib/hash/hash";
import { GameCard, type GameCardProps } from "./GameCard";

vi.mock("./utils/formatSize", () => ({
  formatSize: (bytes: number) => `${bytes} bytes`,
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
    expect(screen.getByRole("button", { name: /games\.watchTooltip|games\.unwatchTooltip/ })).toBeInTheDocument();
  });

  it("does not show watch toggle when not authenticated", () => {
    renderGameCard();
    expect(screen.queryByRole("button", { name: /games\.watchTooltip|games\.unwatchTooltip/ })).not.toBeInTheDocument();
  });

  it("toggles watch state when clicking the eye icon", async () => {
    authenticateUser();
    renderGameCard();

    const toggle = screen.getByRole("button", { name: /games\.watchTooltip|games\.unwatchTooltip/ });
    await userEvent.click(toggle);

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
        "The Sims 4": { hash: "stale-hash", syncedAt: new Date().toISOString() },
      },
    });

    renderGameCard();
    expect(screen.queryByRole("img", { name: "synced" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "games.removeGame" })).toBeInTheDocument();
  });

  it("does not show remove button for auto-detected games", () => {
    renderGameCard();
    expect(screen.queryByRole("button", { name: "games.removeGame" })).not.toBeInTheDocument();
  });

  it("opens confirmation dialog when remove button is clicked", async () => {
    renderGameCard({ game: manualGame });
    await userEvent.click(screen.getByRole("button", { name: "games.removeGame" }));
    expect(screen.getByText("games.removeConfirmTitle")).toBeInTheDocument();
    expect(screen.getByText("games.removeConfirmDescription")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "restore.tooltip" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "restore.tooltipPick" })).toBeInTheDocument();
  });

  it("does not show restore buttons when game has no backup", () => {
    authenticateUser();
    renderGameCard();
    expect(screen.queryByRole("button", { name: "restore.tooltip" })).not.toBeInTheDocument();
  });

  it("hides last modified date when game has no save files", () => {
    renderGameCard({ game: emptyManualGame });
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
  });
});
