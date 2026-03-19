import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { Button } from "@/components/ui/button";
import { AddGameDialog } from "./AddGameDialog";

vi.mock("./AddGameContent", () => ({
  AddGameContent: () => <div data-testid="add-game-content" />,
}));

const renderDialog = () =>
  renderWithProviders(<AddGameDialog trigger={<Button>Add game</Button>} />);

describe("AddGameDialog", () => {
  const user = setupUser();

  it("does not show content initially", () => {
    renderDialog();
    expect(screen.queryByTestId("add-game-content")).not.toBeInTheDocument();
  });

  it("shows content when trigger is clicked", async () => {
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Add game" }));
    expect(screen.getByTestId("add-game-content")).toBeInTheDocument();
  });
});
