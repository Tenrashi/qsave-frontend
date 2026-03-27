import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  renderWithProviders,
  screen,
  waitFor,
  setupUser,
} from "@/test/test-utils";
import { RECORD_STATUS } from "@/domain/types";
import { sims4Game } from "@/test/mocks/games";
import { ConflictWarning } from "./ConflictWarning";

const { mockSyncGame } = vi.hoisted(() => ({
  mockSyncGame: vi.fn(),
}));

vi.mock("@/operations/sync/sync/sync", () => ({
  syncGame: mockSyncGame,
}));

vi.mock("@/lib/store/store", () => ({
  setSyncFingerprint: vi.fn(),
}));

describe("ConflictWarning", () => {
  const user = setupUser();
  const onRestoreAnyway = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncGame.mockResolvedValue({
      id: "s1",
      gameName: "The Sims 4",
      fileName: "The Sims 4.zip",
      syncedAt: new Date(),
      driveFileId: "f1",
      revisionCount: 1,
      status: RECORD_STATUS.success,
    });
  });

  const renderWarning = () =>
    renderWithProviders(
      <ConflictWarning
        game={sims4Game}
        onRestoreAnyway={onRestoreAnyway}
        onClose={onClose}
      />,
    );

  it("renders warning message", () => {
    renderWarning();
    expect(screen.getByText("restore.conflictWarning")).toBeInTheDocument();
  });

  it("renders upload first and restore anyway buttons", () => {
    renderWarning();
    expect(
      screen.getByRole("button", { name: "restore.uploadFirst" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "restore.restoreAnyway" }),
    ).toBeInTheDocument();
  });

  it("calls onRestoreAnyway when restore anyway is clicked", async () => {
    renderWarning();
    await user.click(
      screen.getByRole("button", { name: "restore.restoreAnyway" }),
    );
    expect(onRestoreAnyway).toHaveBeenCalled();
  });

  it("syncs and closes when upload first is clicked", async () => {
    renderWarning();
    await user.click(
      screen.getByRole("button", { name: "restore.uploadFirst" }),
    );

    await waitFor(() => {
      expect(mockSyncGame).toHaveBeenCalledWith(sims4Game);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("disables buttons while uploading", async () => {
    let resolveSyncGame: (value: unknown) => void;
    mockSyncGame.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSyncGame = resolve;
      }),
    );

    renderWarning();
    await user.click(
      screen.getByRole("button", { name: "restore.uploadFirst" }),
    );

    expect(
      screen.getByRole("button", { name: "restore.uploadFirst" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "restore.restoreAnyway" }),
    ).toBeDisabled();

    resolveSyncGame!({
      status: RECORD_STATUS.success,
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
