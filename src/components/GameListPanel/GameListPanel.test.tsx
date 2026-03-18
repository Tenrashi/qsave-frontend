import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { twoGames } from "@/test/mocks/games";
import { GameListPanel } from "./GameListPanel";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 64,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 64,
        size: 56,
        key: i,
      })),
  }),
}));

describe("GameListPanel", () => {
  it("shows loading spinner when loading", () => {
    renderWithProviders(<GameListPanel games={[]} isLoading={true} />);
    expect(screen.getByText("games.scanning")).toBeInTheDocument();
  });

  it("renders games list when not loading", () => {
    renderWithProviders(<GameListPanel games={twoGames} isLoading={false} />);
    expect(screen.getByText("The Sims 4")).toBeInTheDocument();
    expect(screen.getByText("Cyberpunk 2077")).toBeInTheDocument();
  });

  it("shows empty state when no games and not loading", () => {
    renderWithProviders(<GameListPanel games={[]} isLoading={false} />);
    expect(screen.getByText("games.noGamesDetected")).toBeInTheDocument();
  });
});
