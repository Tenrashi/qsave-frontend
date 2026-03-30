import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { Button } from "@/components/ui/button";
import { AddGameDialog } from "./AddGameDialog";

const { mockOnClose } = vi.hoisted(() => ({
  mockOnClose: vi.fn(),
}));

vi.mock("./AddGameContent", () => ({
  AddGameContent: ({
    name,
    paths,
    onNameChange,
    onPathsChange,
    onClose,
  }: {
    name: string;
    paths: string[];
    onNameChange: (name: string) => void;
    onPathsChange: (paths: string[]) => void;
    onClose: () => void;
  }) => {
    mockOnClose.mockImplementation(onClose);
    return (
      <div data-testid="add-game-content">
        <span data-testid="name-value">{name}</span>
        <span data-testid="paths-value">{paths.join(",")}</span>
        <button onClick={() => onNameChange("Test")}>SetName</button>
        <button onClick={() => onPathsChange(["/test"])}>SetPaths</button>
        <button onClick={onClose}>Close</button>
      </div>
    );
  },
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

  it("resets name and paths when dialog closes", async () => {
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Add game" }));
    await user.click(screen.getByText("SetName"));
    await user.click(screen.getByText("SetPaths"));

    expect(screen.getByTestId("name-value")).toHaveTextContent("Test");
    expect(screen.getByTestId("paths-value")).toHaveTextContent("/test");

    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Add game" }));
    expect(screen.getByTestId("name-value")).toHaveTextContent("");
    expect(screen.getByTestId("paths-value")).toHaveTextContent("");
  });

  it("resets state and closes dialog on handleClose", async () => {
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Add game" }));
    await user.click(screen.getByText("SetName"));
    await user.click(screen.getByText("SetPaths"));
    await user.click(screen.getByText("Close"));

    expect(screen.queryByTestId("add-game-content")).not.toBeInTheDocument();
  });
});
