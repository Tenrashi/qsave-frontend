import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { Dialog } from "@/components/ui/dialog";
import { RemoveGameContent } from "./RemoveGameContent";

const renderContent = (onConfirm = vi.fn()) =>
  renderWithProviders(
    <Dialog open={true}>
      <RemoveGameContent onConfirm={onConfirm} />
    </Dialog>,
  );

describe("RemoveGameContent", () => {
  const user = setupUser();

  it("renders title and description", () => {
    renderContent();
    expect(screen.getByText("games.removeConfirmTitle")).toBeInTheDocument();
    expect(
      screen.getByText("games.removeConfirmDescription"),
    ).toBeInTheDocument();
  });

  it("calls onConfirm when remove button is clicked", async () => {
    const onConfirm = vi.fn();
    renderContent(onConfirm);

    await user.click(screen.getByRole("button", { name: "games.remove" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("renders cancel button", () => {
    renderContent();
    expect(
      screen.getByRole("button", { name: "games.cancel" }),
    ).toBeInTheDocument();
  });
});
