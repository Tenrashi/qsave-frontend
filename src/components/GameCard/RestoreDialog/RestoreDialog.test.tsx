import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { sims4Game } from "@/test/mocks/games";
import { Button } from "@/components/ui/button";
import { RestoreDialog } from "./RestoreDialog";

vi.mock("./RestoreContent", () => ({
  RestoreContent: () => <div data-testid="restore-content" />,
}));

const renderDialog = () =>
  renderWithProviders(
    <RestoreDialog game={sims4Game} trigger={<Button>Restore</Button>} />,
  );

describe("RestoreDialog", () => {
  const user = setupUser();

  it("does not show content initially", () => {
    renderDialog();
    expect(screen.queryByTestId("restore-content")).not.toBeInTheDocument();
  });

  it("shows content when trigger is clicked", async () => {
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(screen.getByTestId("restore-content")).toBeInTheDocument();
  });
});
