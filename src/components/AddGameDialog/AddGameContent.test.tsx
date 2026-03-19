import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { Dialog } from "@/components/ui/dialog";
import { AddGameContent, type AddGameContentProps } from "./AddGameContent";

const { mockInvoke, mockAddManualGame, mockScanManualGame } = vi.hoisted(
  () => ({
    mockInvoke: vi.fn(),
    mockAddManualGame: vi.fn(),
    mockScanManualGame: vi.fn(() =>
      Promise.resolve({
        name: "My Game",
        savePaths: ["/saves/mygame"],
        saveFiles: [],
        isManual: true,
      }),
    ),
  }),
);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@/lib/store/store", () => ({
  addManualGame: mockAddManualGame,
}));

vi.mock("@/services/scanner/scanner", () => ({
  scanManualGame: mockScanManualGame,
}));

const defaultProps: AddGameContentProps = {
  name: "",
  paths: [],
  onNameChange: vi.fn(),
  onPathsChange: vi.fn(),
  onClose: vi.fn(),
};

const renderContent = (overrides: Partial<AddGameContentProps> = {}) =>
  renderWithProviders(
    <Dialog open={true}>
      <AddGameContent {...defaultProps} {...overrides} />
    </Dialog>,
  );

describe("AddGameContent", () => {
  const user = setupUser();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty paths message when no paths", () => {
    renderContent();
    expect(screen.getByText("games.noPathsAdded")).toBeInTheDocument();
  });

  it("disables add button when name is empty", () => {
    renderContent();
    expect(screen.getByRole("button", { name: "games.add" })).toBeDisabled();
  });

  it("disables add button when no paths are added", () => {
    renderContent({ name: "My Game" });
    expect(screen.getByRole("button", { name: "games.add" })).toBeDisabled();
  });

  it("enables add button when name and paths are provided", () => {
    renderContent({ name: "My Game", paths: ["/saves/mygame"] });
    expect(screen.getByRole("button", { name: "games.add" })).toBeEnabled();
  });

  it("calls onPathsChange via browse", async () => {
    const onPathsChange = vi.fn();
    mockInvoke.mockResolvedValueOnce("/saves/mygame");

    renderContent({ onPathsChange });
    await user.click(screen.getByRole("button", { name: "games.browsePath" }));

    expect(onPathsChange).toHaveBeenCalledWith(["/saves/mygame"]);
  });

  it("does not add duplicate paths", async () => {
    const onPathsChange = vi.fn();
    mockInvoke.mockResolvedValueOnce("/saves/mygame");

    renderContent({ paths: ["/saves/mygame"], onPathsChange });
    await user.click(screen.getByRole("button", { name: "games.browsePath" }));

    expect(onPathsChange).not.toHaveBeenCalled();
  });

  it("displays existing paths", () => {
    renderContent({ paths: ["/saves/mygame"] });
    expect(screen.getByText("/saves/mygame")).toBeInTheDocument();
    expect(screen.queryByText("games.noPathsAdded")).not.toBeInTheDocument();
  });

  it("calls onPathsChange when removing a path", async () => {
    const onPathsChange = vi.fn();
    renderContent({ paths: ["/saves/mygame"], onPathsChange });

    await user.click(screen.getByTitle("games.removePath"));
    expect(onPathsChange).toHaveBeenCalledWith([]);
  });

  it("submits and calls onClose", async () => {
    const onClose = vi.fn();
    renderContent({ name: "My Game", paths: ["/saves/mygame"], onClose });

    await user.click(screen.getByRole("button", { name: "games.add" }));

    expect(mockScanManualGame).toHaveBeenCalledWith("My Game", [
      "/saves/mygame",
    ]);
    expect(mockAddManualGame).toHaveBeenCalledWith("My Game", [
      "/saves/mygame",
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it("handles browse cancellation gracefully", async () => {
    const onPathsChange = vi.fn();
    mockInvoke.mockResolvedValueOnce(null);

    renderContent({ onPathsChange });
    await user.click(screen.getByRole("button", { name: "games.browsePath" }));

    expect(onPathsChange).not.toHaveBeenCalled();
  });
});
