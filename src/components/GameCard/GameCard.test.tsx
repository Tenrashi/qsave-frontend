import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { useAuthStore } from "@/stores/auth";
import { sims4Game, eldenRingGame } from "@/test/mocks/games";
import { GameCard, type GameCardProps } from "./GameCard";

vi.mock("./utils/formatSize", () => ({
  formatSize: (bytes: number) => `${bytes} bytes`,
}));

const defaultProps: GameCardProps = {
  game: sims4Game,
};

const renderGameCard = (overrides: Partial<GameCardProps> = {}) => {
  return renderWithProviders(<GameCard {...defaultProps} {...overrides} />);
};

describe("GameCard", () => {
  beforeEach(() => {
    useAuthStore.setState({ auth: { isAuthenticated: false }, loading: false });
  });

  it("renders game name and aggregated size", () => {
    renderGameCard();
    expect(screen.getByText("The Sims 4")).toBeInTheDocument();
    // 12_582_912 + 8_388_608 = 20_971_520
    expect(screen.getByText("20971520 bytes")).toBeInTheDocument();
  });

  it("does not show sync button when not authenticated", () => {
    renderGameCard();
    expect(screen.queryByText("Sync")).not.toBeInTheDocument();
  });

  it("shows sync button when authenticated", () => {
    useAuthStore.setState({
      auth: { isAuthenticated: true, email: "test@gmail.com" },
      loading: false,
    });
    renderGameCard();
    expect(screen.getByText("Sync")).toBeInTheDocument();
  });

  it("renders with custom game", () => {
    renderGameCard({ game: eldenRingGame });
    expect(screen.getByText("Elden Ring")).toBeInTheDocument();
  });
});
