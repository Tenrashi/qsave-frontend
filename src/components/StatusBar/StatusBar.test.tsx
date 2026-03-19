import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { twoGames } from "@/test/mocks/games";
import { StatusBar, type StatusBarProps } from "./StatusBar";

const defaultProps: StatusBarProps = {
  games: [],
  watching: false,
  onToggleWatching: vi.fn(),
};

const renderStatusBar = (overrides: Partial<StatusBarProps> = {}) => {
  return renderWithProviders(<StatusBar {...defaultProps} {...overrides} />);
};

describe("StatusBar", () => {
  const user = setupUser();

  it("shows game count", () => {
    renderStatusBar({ games: twoGames });
    expect(screen.getByText("status.game")).toBeInTheDocument();
  });

  it("shows watching active when watching is true", () => {
    renderStatusBar({ watching: true });
    expect(screen.getByText("status.watchingActive")).toBeInTheDocument();
  });

  it("shows watching inactive when watching is false", () => {
    renderStatusBar({ watching: false });
    expect(screen.getByText("status.watchingInactive")).toBeInTheDocument();
  });

  it("calls onToggleWatching when clicking the watch button", async () => {
    const onToggle = vi.fn();
    renderStatusBar({ watching: true, onToggleWatching: onToggle });

    await user.click(screen.getByText("status.watchingActive"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("toggles icon between eye and eye-off", () => {
    const { rerender } = renderStatusBar({ watching: true });
    expect(screen.getByText("status.watchingActive")).toBeInTheDocument();

    rerender(<StatusBar {...defaultProps} watching={false} />);
    expect(screen.getByText("status.watchingInactive")).toBeInTheDocument();
  });
});
