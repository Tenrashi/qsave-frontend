import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { RemoveGameDialog } from "./RemoveGameDialog";
import { Button } from "@/components/ui/button";

vi.mock("./RemoveGameContent/RemoveGameContent", () => ({
  RemoveGameContent: ({ onConfirm }: { onConfirm: () => void }) => (
    <div data-testid="remove-game-content">
      <button onClick={onConfirm}>Confirm</button>
    </div>
  ),
}));

const renderDialog = (onConfirm = vi.fn()) => {
  renderWithProviders(
    <RemoveGameDialog
      onConfirm={onConfirm}
      trigger={<Button>Delete</Button>}
    />,
  );
  return { onConfirm };
};

describe("RemoveGameDialog", () => {
  const user = setupUser();

  it("does not show content initially", () => {
    renderDialog();
    expect(screen.queryByTestId("remove-game-content")).not.toBeInTheDocument();
  });

  it("shows content when trigger is clicked", async () => {
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByTestId("remove-game-content")).toBeInTheDocument();
  });

  it("calls onConfirm and closes dialog on confirm", async () => {
    const { onConfirm } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("remove-game-content")).not.toBeInTheDocument();
  });
});
