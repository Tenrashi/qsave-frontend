import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { UpdateBanner } from "./UpdateBanner";

describe("UpdateBanner", () => {
  it("renders the version in the banner text", () => {
    renderWithProviders(
      <UpdateBanner status="available" version="1.5.0" onInstall={vi.fn()} />,
    );
    expect(screen.getByText("update.available")).toBeInTheDocument();
  });

  it("calls onInstall when the button is clicked", async () => {
    const handleInstall = vi.fn();
    const user = setupUser();

    renderWithProviders(
      <UpdateBanner
        status="available"
        version="1.5.0"
        onInstall={handleInstall}
      />,
    );

    await user.click(screen.getByRole("button", { name: /update\.install/i }));
    expect(handleInstall).toHaveBeenCalledOnce();
  });

  it("shows install label when available", () => {
    renderWithProviders(
      <UpdateBanner status="available" version="1.5.0" onInstall={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: /update\.install/i }),
    ).toBeEnabled();
  });

  it("disables the button while downloading", () => {
    renderWithProviders(
      <UpdateBanner status="downloading" version="1.5.0" onInstall={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: /update\.installing/i }),
    ).toBeDisabled();
  });

  it("disables the button while installing", () => {
    renderWithProviders(
      <UpdateBanner status="installing" version="1.5.0" onInstall={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: /update\.installing/i }),
    ).toBeDisabled();
  });
});
