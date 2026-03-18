import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { GameToolbar, type GameToolbarProps } from "./GameToolbar";

const defaultProps: GameToolbarProps = {
  search: "",
  onSearchChange: vi.fn(),
};

const renderToolbar = (overrides: Partial<GameToolbarProps> = {}) =>
  renderWithProviders(<GameToolbar {...defaultProps} {...overrides} />);

describe("GameToolbar", () => {
  it("renders search bar", () => {
    renderToolbar();
    expect(screen.getByPlaceholderText("search.placeholder")).toBeInTheDocument();
  });

  it("renders add game button", () => {
    renderToolbar();
    expect(screen.getByText("games.addGame")).toBeInTheDocument();
  });
});
