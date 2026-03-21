import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { GameToolbar, type GameToolbarProps } from "./GameToolbar";

const defaultProps: GameToolbarProps = {
  search: "",
  onSearchChange: vi.fn(),
  hideSteamCloud: false,
  onToggleHideSteamCloud: vi.fn(),
};

const renderToolbar = (overrides: Partial<GameToolbarProps> = {}) =>
  renderWithProviders(<GameToolbar {...defaultProps} {...overrides} />);

describe("GameToolbar", () => {
  it("renders search bar", () => {
    renderToolbar();
    expect(
      screen.getByPlaceholderText("search.placeholder"),
    ).toBeInTheDocument();
  });

  it("renders add game button", () => {
    renderToolbar();
    expect(screen.getByText("games.addGame")).toBeInTheDocument();
  });

  it("renders steam cloud toggle button", () => {
    renderToolbar();
    expect(screen.getByTitle("games.hideSteamCloud")).toBeInTheDocument();
  });

  it("shows show tooltip when steam cloud games are hidden", () => {
    renderToolbar({ hideSteamCloud: true });
    expect(screen.getByTitle("games.showSteamCloud")).toBeInTheDocument();
  });

  it("calls onToggleHideSteamCloud when toggle is clicked", async () => {
    const user = setupUser();
    const onToggle = vi.fn();
    renderToolbar({ onToggleHideSteamCloud: onToggle });
    await user.click(screen.getByTitle("games.hideSteamCloud"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
