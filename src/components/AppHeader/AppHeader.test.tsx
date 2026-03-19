import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { AppHeader, type AppHeaderProps } from "./AppHeader";
import { APP_NAME } from "@/lib/constants/constants";

const defaultProps: AppHeaderProps = {
  isFetching: false,
  onRefresh: vi.fn(),
};

const renderHeader = (overrides: Partial<AppHeaderProps> = {}) =>
  renderWithProviders(<AppHeader {...defaultProps} {...overrides} />);

describe("AppHeader", () => {
  it("renders app name", () => {
    renderHeader();
    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
  });

  it("calls onRefresh when refresh button clicked", async () => {
    const onRefresh = vi.fn();
    const user = setupUser();
    renderHeader({ onRefresh });

    await user.click(screen.getByText("app.refresh"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("disables refresh button when fetching", () => {
    renderHeader({ isFetching: true });
    expect(screen.getByText("app.refresh").closest("button")).toBeDisabled();
  });
});
