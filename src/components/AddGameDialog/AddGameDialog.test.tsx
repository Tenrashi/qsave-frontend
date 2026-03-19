import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { AddGameDialog } from "./AddGameDialog";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/lib/store/store", () => ({
  addManualGame: vi.fn(),
}));

vi.mock("@/services/scanner/scanner", () => ({
  scanManualGame: vi.fn(() =>
    Promise.resolve({
      name: "My Game",
      savePaths: ["/saves/mygame"],
      saveFiles: [],
      isManual: true,
    }),
  ),
}));

const renderDialog = () =>
  renderWithProviders(
    <AddGameDialog trigger={<Button>Add game</Button>} />,
  );

const openDialog = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Add game" }));
};

describe("AddGameDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show dialog initially", () => {
    renderDialog();
    expect(screen.queryByText("games.addGameTitle")).not.toBeInTheDocument();
  });

  it("opens dialog when trigger is clicked", async () => {
    renderDialog();
    await openDialog();

    expect(screen.getByText("games.addGameTitle")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("games.gameNamePlaceholder")).toBeInTheDocument();
  });

  it("shows empty paths message initially", async () => {
    renderDialog();
    await openDialog();

    expect(screen.getByText("games.noPathsAdded")).toBeInTheDocument();
  });

  it("disables add button when name is empty", async () => {
    renderDialog();
    await openDialog();

    expect(screen.getByRole("button", { name: "games.add" })).toBeDisabled();
  });

  it("disables add button when no paths are added", async () => {
    renderDialog();
    await openDialog();

    await userEvent.type(screen.getByPlaceholderText("games.gameNamePlaceholder"), "My Game");

    expect(screen.getByRole("button", { name: "games.add" })).toBeDisabled();
  });

  it("adds a path via browse and shows it in the list", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("/saves/mygame");

    renderDialog();
    await openDialog();

    await userEvent.click(screen.getByRole("button", { name: "games.browsePath" }));

    expect(screen.getByText("/saves/mygame")).toBeInTheDocument();
    expect(screen.queryByText("games.noPathsAdded")).not.toBeInTheDocument();
  });

  it("enables add button when name and path are provided", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("/saves/mygame");

    renderDialog();
    await openDialog();

    await userEvent.type(screen.getByPlaceholderText("games.gameNamePlaceholder"), "My Game");
    await userEvent.click(screen.getByRole("button", { name: "games.browsePath" }));

    expect(screen.getByRole("button", { name: "games.add" })).toBeEnabled();
  });

  it("removes a path when trash button is clicked", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("/saves/mygame");

    renderDialog();
    await openDialog();

    await userEvent.click(screen.getByRole("button", { name: "games.browsePath" }));
    expect(screen.getByText("/saves/mygame")).toBeInTheDocument();

    await userEvent.click(screen.getByTitle("games.removePath"));
    expect(screen.queryByText("/saves/mygame")).not.toBeInTheDocument();
  });

  it("does not add duplicate paths", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce("/saves/mygame")
      .mockResolvedValueOnce("/saves/mygame");

    renderDialog();
    await openDialog();

    await userEvent.click(screen.getByRole("button", { name: "games.browsePath" }));
    await userEvent.click(screen.getByRole("button", { name: "games.browsePath" }));

    expect(screen.getAllByText("/saves/mygame")).toHaveLength(1);
  });

  it("submits and closes dialog on add", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("/saves/mygame");
    const { addManualGame } = await import("@/lib/store/store");
    const { scanManualGame } = await import("@/services/scanner/scanner");

    renderDialog();
    await openDialog();

    await userEvent.type(screen.getByPlaceholderText("games.gameNamePlaceholder"), "My Game");
    await userEvent.click(screen.getByRole("button", { name: "games.browsePath" }));
    await userEvent.click(screen.getByRole("button", { name: "games.add" }));

    expect(scanManualGame).toHaveBeenCalledWith("My Game", ["/saves/mygame"]);
    expect(addManualGame).toHaveBeenCalledWith("My Game", ["/saves/mygame"]);
  });

  it("handles browse cancellation gracefully", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(null);

    renderDialog();
    await openDialog();

    await userEvent.click(screen.getByRole("button", { name: "games.browsePath" }));

    expect(screen.getByText("games.noPathsAdded")).toBeInTheDocument();
  });
});
