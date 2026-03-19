import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { RemoveGameDialog } from "./RemoveGameDialog";
import { Button } from "@/components/ui/button";

vi.mock("./RemoveGameContent", () => ({
  RemoveGameContent: () => <div data-testid="remove-game-content" />,
}));

const renderDialog = () =>
  renderWithProviders(
    <RemoveGameDialog onConfirm={vi.fn()} trigger={<Button>Delete</Button>} />,
  );

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
});
