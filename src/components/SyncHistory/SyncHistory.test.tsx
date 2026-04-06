import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { SyncHistory } from "./SyncHistory";

vi.mock("@/lib/store/store", () => ({
  getSyncHistory: vi.fn(() =>
    Promise.resolve([
      {
        id: "1",
        gameName: "The Sims 4",
        fileName: "The Sims 4.zip",
        syncedAt: new Date(),
        driveFileId: "abc",
        revisionCount: 1,
        status: "success",
        type: "sync",
      },
      {
        id: "2",
        gameName: "Cyberpunk 2077",
        fileName: "Cyberpunk 2077.zip",
        syncedAt: new Date(),
        driveFileId: "",
        revisionCount: 0,
        status: "error",
        error: "Network error",
      },
      {
        id: "3",
        gameName: "Elden Ring",
        fileName: "Elden Ring.zip",
        syncedAt: new Date(),
        driveFileId: "def",
        revisionCount: 2,
        status: "success",
        type: "restore",
      },
    ]),
  ),
}));

describe("SyncHistory", () => {
  it("renders game names", async () => {
    renderWithProviders(<SyncHistory />);
    expect(await screen.findByText("The Sims 4")).toBeInTheDocument();
    expect(screen.getByText("Cyberpunk 2077")).toBeInTheDocument();
    expect(screen.getByText("Elden Ring")).toBeInTheDocument();
  });

  it("shows success icon for successful syncs", async () => {
    renderWithProviders(<SyncHistory />);
    await screen.findByText("The Sims 4");
    expect(
      screen.getAllByRole("img", { name: "history.successIcon" }),
    ).toHaveLength(2);
  });

  it("shows error icon for failed syncs", async () => {
    renderWithProviders(<SyncHistory />);
    await screen.findByText("Cyberpunk 2077");
    expect(
      screen.getAllByRole("img", { name: "history.errorIcon" }),
    ).toHaveLength(1);
  });

  it("shows error message tooltip on hover", async () => {
    const user = setupUser();
    renderWithProviders(<SyncHistory />);
    const errorIcon = await screen.findByRole("img", {
      name: "history.errorIcon",
    });

    await user.hover(errorIcon);

    expect(await screen.findByText("Network error")).toBeInTheDocument();
  });
});
