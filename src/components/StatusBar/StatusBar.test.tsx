import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { twoGames } from "@/test/mocks/games";
import { StatusBar, type StatusBarProps } from "./StatusBar";

const defaultProps: StatusBarProps = {
  games: [],
  watchedCount: 0,
};

const renderStatusBar = (overrides: Partial<StatusBarProps> = {}) => {
  return renderWithProviders(<StatusBar {...defaultProps} {...overrides} />);
};

describe("StatusBar", () => {
  it("shows game count", () => {
    renderStatusBar({ games: twoGames, watchedCount: 2 });
    expect(screen.getByText("2 games")).toBeInTheDocument();
  });

  it("shows watching active when watchedCount > 0", () => {
    renderStatusBar({ watchedCount: 1 });
    expect(screen.getByText("Watching active")).toBeInTheDocument();
  });

  it("shows watching inactive when watchedCount is 0", () => {
    renderStatusBar();
    expect(screen.getByText("Watching inactive")).toBeInTheDocument();
  });
});
