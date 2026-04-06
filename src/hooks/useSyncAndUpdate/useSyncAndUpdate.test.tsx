import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SYNC_STATUS, RECORD_STATUS } from "@/domain/types";
import type { SyncResult } from "@/operations/sync/sync/sync";
import { useSyncStore } from "@/stores/sync";
import { renderHook, waitFor } from "@/test/test-utils";
import { sims4Game } from "@/test/mocks/games";
import { useSyncAndUpdate } from "./useSyncAndUpdate";

const { mockSyncGame, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockSyncGame: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/operations/sync/sync/sync", () => ({
  syncGame: mockSyncGame,
}));

vi.mock("@/lib/store/store", () => ({
  setSyncFingerprint: vi.fn(),
}));

const successResult: SyncResult = {
  id: "sync-1",
  gameName: "The Sims 4",
  fileName: "The Sims 4.zip",
  syncedAt: new Date(),
  driveFileId: "file-123",
  revisionCount: 1,
  status: RECORD_STATUS.success,
  contentHash: "hash-abc",
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useSyncAndUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSyncStore.setState({
      gameStatuses: {},
      syncFingerprints: {},
      backedUpGames: new Set<string>(),
      backedUpGamesLoaded: false,
    });
    mockSyncGame.mockResolvedValue(successResult);
  });

  it("sets syncing status before calling syncGame", async () => {
    const statuses: string[] = [];
    const originalSet = useSyncStore.getState().setGameStatus;
    vi.spyOn(useSyncStore.getState(), "setGameStatus").mockImplementation(
      (gameName, status) => {
        statuses.push(status);
        originalSet(gameName, status);
      },
    );

    const { result } = renderHook(() => useSyncAndUpdate(), {
      wrapper: createWrapper(),
    });

    await result.current(sims4Game);

    expect(statuses[0]).toBe(SYNC_STATUS.syncing);
    expect(mockSyncGame).toHaveBeenCalledWith(sims4Game);
  });

  it("sets success status and shows success toast after successful sync", async () => {
    const { result } = renderHook(() => useSyncAndUpdate(), {
      wrapper: createWrapper(),
    });

    await result.current(sims4Game);

    expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
      SYNC_STATUS.success,
    );
    expect(mockToastSuccess).toHaveBeenCalledWith("toast.syncSuccess");
  });

  it("marks game as backed up on success", async () => {
    const { result } = renderHook(() => useSyncAndUpdate(), {
      wrapper: createWrapper(),
    });

    await result.current(sims4Game);

    expect(useSyncStore.getState().backedUpGames.has("The Sims 4")).toBe(true);
  });

  it("updates sync fingerprint on success with contentHash", async () => {
    const { result } = renderHook(() => useSyncAndUpdate(), {
      wrapper: createWrapper(),
    });

    await result.current(sims4Game);

    await waitFor(() => {
      const fingerprint =
        useSyncStore.getState().syncFingerprints["The Sims 4"];
      expect(fingerprint?.hash).toBe("hash-abc");
    });
  });

  it("does not update fingerprint when contentHash is missing", async () => {
    mockSyncGame.mockResolvedValueOnce({
      ...successResult,
      contentHash: undefined,
    });

    const { result } = renderHook(() => useSyncAndUpdate(), {
      wrapper: createWrapper(),
    });

    await result.current(sims4Game);

    expect(
      useSyncStore.getState().syncFingerprints["The Sims 4"],
    ).toBeUndefined();
  });

  it("sets error status and shows error toast when sync returns error record", async () => {
    mockSyncGame.mockResolvedValueOnce({
      ...successResult,
      status: RECORD_STATUS.error,
      error: "upload failed",
    });

    const { result } = renderHook(() => useSyncAndUpdate(), {
      wrapper: createWrapper(),
    });

    await result.current(sims4Game);

    expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
      SYNC_STATUS.error,
    );
    expect(mockToastError).toHaveBeenCalledWith("toast.syncFailed", {
      description: "upload failed",
      duration: 10_000,
    });
  });

  it("sets error status, shows error toast, and rethrows when syncGame throws", async () => {
    mockSyncGame.mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() => useSyncAndUpdate(), {
      wrapper: createWrapper(),
    });

    await expect(result.current(sims4Game)).rejects.toThrow("network error");

    expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
      SYNC_STATUS.error,
    );
    expect(mockToastError).toHaveBeenCalledWith("toast.syncFailed", {
      description: "network error",
      duration: 10_000,
    });
  });

  it("shows stringified error in toast when syncGame throws a non-Error value", async () => {
    mockSyncGame.mockRejectedValueOnce("raw string failure");

    const { result } = renderHook(() => useSyncAndUpdate(), {
      wrapper: createWrapper(),
    });

    await expect(result.current(sims4Game)).rejects.toBe("raw string failure");

    expect(mockToastError).toHaveBeenCalledWith("toast.syncFailed", {
      description: "raw string failure",
      duration: 10_000,
    });
  });

  it("returns the sync result on success", async () => {
    const { result } = renderHook(() => useSyncAndUpdate(), {
      wrapper: createWrapper(),
    });

    const syncResult = await result.current(sims4Game);

    expect(syncResult).toEqual(successResult);
  });
});
