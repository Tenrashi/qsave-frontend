import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SYNC_STATUS } from "@/domain/types";
import type { SyncRecord } from "@/domain/types";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { sims4Game, cyberpunkGame } from "@/test/mocks/games";
import { useAutoSync } from "./useAutoSync";

const {
  mockStartWatching,
  mockStopWatching,
  mockScheduleAutoSync,
  mockCancelAllAutoSyncs,
  mockSyncGame,
  mockRescanGame,
  mockComputeGameHash,
} = vi.hoisted(() => ({
  mockStartWatching: vi.fn(),
  mockStopWatching: vi.fn(),
  mockScheduleAutoSync: vi.fn(),
  mockCancelAllAutoSyncs: vi.fn(),
  mockSyncGame: vi.fn(),
  mockRescanGame: vi.fn(),
  mockComputeGameHash: vi.fn(() => "hash-abc"),
}));

vi.mock("@/lib/watcher/watcher", () => ({
  startWatching: mockStartWatching,
  stopWatching: mockStopWatching,
}));

vi.mock("@/lib/autoSync/autoSync", () => ({
  scheduleAutoSync: mockScheduleAutoSync,
  cancelAllAutoSyncs: mockCancelAllAutoSyncs,
}));

vi.mock("@/services/sync/sync", () => ({
  syncGame: mockSyncGame,
}));

vi.mock("@/services/scanner/scanner", () => ({
  rescanGame: mockRescanGame,
}));

vi.mock("@/lib/hash/hash", () => ({
  computeGameHash: mockComputeGameHash,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const triggerWatcherCallback = (changedPaths: string[]) => {
  const callback = mockStartWatching.mock.calls[0][1];
  callback(changedPaths);
};

describe("useAutoSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ auth: { isAuthenticated: false }, loading: false });
    useSyncStore.setState({
      gameStatuses: {},
      watchedGames: {},
      syncFingerprints: {},
      backedUpGames: new Set(),
      backedUpGamesLoaded: false,
    });
  });

  it("stops watching when disabled", () => {
    renderHook(() => useAutoSync([sims4Game], false), {
      wrapper: createWrapper(),
    });

    expect(mockStopWatching).toHaveBeenCalled();
    expect(mockCancelAllAutoSyncs).toHaveBeenCalled();
  });

  it("starts watching when enabled with games", () => {
    renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    expect(mockStartWatching).toHaveBeenCalledWith(
      ["/saves/sims4"],
      expect.any(Function),
    );
  });

  it("stops watching when no games", () => {
    renderHook(() => useAutoSync([], true), { wrapper: createWrapper() });

    expect(mockStopWatching).toHaveBeenCalled();
  });

  it("stops watching when games is undefined", () => {
    renderHook(() => useAutoSync(undefined, true), {
      wrapper: createWrapper(),
    });

    expect(mockStopWatching).toHaveBeenCalled();
  });

  it("rescans affected games on file change", async () => {
    const updatedGame = { ...sims4Game, saveFiles: [] };
    mockRescanGame.mockResolvedValueOnce(updatedGame);

    renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    await act(() => {
      triggerWatcherCallback(["/saves/sims4/Slot_001.save"]);
    });

    expect(mockRescanGame).toHaveBeenCalledWith(sims4Game);
  });

  it("skips auto sync when not authenticated", async () => {
    mockRescanGame.mockResolvedValueOnce(sims4Game);

    renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    await act(() => {
      triggerWatcherCallback(["/saves/sims4/save.dat"]);
    });

    expect(mockScheduleAutoSync).not.toHaveBeenCalled();
  });

  it("skips auto sync when game is not watched", async () => {
    useAuthStore.setState({ auth: { isAuthenticated: true } });
    mockRescanGame.mockResolvedValueOnce(sims4Game);

    renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    await act(() => {
      triggerWatcherCallback(["/saves/sims4/save.dat"]);
    });

    expect(mockScheduleAutoSync).not.toHaveBeenCalled();
  });

  it("skips auto sync when game is already syncing", async () => {
    useAuthStore.setState({ auth: { isAuthenticated: true } });
    useSyncStore.setState({
      watchedGames: { "The Sims 4": true },
      gameStatuses: { "The Sims 4": SYNC_STATUS.syncing },
    });
    mockRescanGame.mockResolvedValueOnce(sims4Game);

    renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    await act(() => {
      triggerWatcherCallback(["/saves/sims4/save.dat"]);
    });

    expect(mockScheduleAutoSync).not.toHaveBeenCalled();
  });

  it("schedules auto sync for authenticated watched game", async () => {
    useAuthStore.setState({ auth: { isAuthenticated: true } });
    useSyncStore.setState({ watchedGames: { "The Sims 4": true } });
    mockRescanGame.mockResolvedValueOnce(sims4Game);

    renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    await act(() => {
      triggerWatcherCallback(["/saves/sims4/save.dat"]);
    });

    expect(mockScheduleAutoSync).toHaveBeenCalledWith(
      "The Sims 4",
      expect.any(Function),
    );
  });

  it("skips sync when fingerprint hash matches", async () => {
    useAuthStore.setState({ auth: { isAuthenticated: true } });
    useSyncStore.setState({
      watchedGames: { "The Sims 4": true },
      syncFingerprints: {
        "The Sims 4": { hash: "hash-abc", syncedAt: "2024-01-01" },
      },
    });
    mockRescanGame.mockResolvedValueOnce(sims4Game);
    mockComputeGameHash.mockReturnValueOnce("hash-abc");

    renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    await act(() => {
      triggerWatcherCallback(["/saves/sims4/save.dat"]);
    });

    const syncCallback = mockScheduleAutoSync.mock.calls[0][1];
    syncCallback();

    expect(mockSyncGame).not.toHaveBeenCalled();
  });

  it("syncs game when fingerprint hash differs", async () => {
    useAuthStore.setState({ auth: { isAuthenticated: true } });
    useSyncStore.setState({ watchedGames: { "The Sims 4": true } });
    mockRescanGame.mockResolvedValueOnce(sims4Game);
    mockComputeGameHash.mockReturnValueOnce("new-hash");
    const syncPromise = Promise.resolve({
      status: SYNC_STATUS.success,
    } as SyncRecord);
    mockSyncGame.mockReturnValueOnce(syncPromise);

    renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    await act(() => {
      triggerWatcherCallback(["/saves/sims4/save.dat"]);
    });

    const syncCallback = mockScheduleAutoSync.mock.calls[0][1];
    await act(async () => {
      syncCallback();
      await syncPromise;
    });

    expect(mockSyncGame).toHaveBeenCalledWith(sims4Game);
  });

  it("sets error status when sync fails", async () => {
    useAuthStore.setState({ auth: { isAuthenticated: true } });
    useSyncStore.setState({ watchedGames: { "The Sims 4": true } });
    mockRescanGame.mockResolvedValueOnce(sims4Game);
    mockSyncGame.mockRejectedValueOnce(new Error("upload failed"));

    renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    await act(() => {
      triggerWatcherCallback(["/saves/sims4/save.dat"]);
    });

    const syncCallback = mockScheduleAutoSync.mock.calls[0][1];
    await act(() => {
      syncCallback();
    });

    expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
      SYNC_STATUS.error,
    );
  });

  it("sets error status when sync record has error status", async () => {
    useAuthStore.setState({ auth: { isAuthenticated: true } });
    useSyncStore.setState({ watchedGames: { "The Sims 4": true } });
    mockRescanGame.mockResolvedValueOnce(sims4Game);
    const syncPromise = Promise.resolve({
      status: SYNC_STATUS.error,
    } as SyncRecord);
    mockSyncGame.mockReturnValueOnce(syncPromise);

    renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    await act(() => {
      triggerWatcherCallback(["/saves/sims4/save.dat"]);
    });

    const syncCallback = mockScheduleAutoSync.mock.calls[0][1];
    await act(async () => {
      syncCallback();
      await syncPromise;
    });

    expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
      SYNC_STATUS.error,
    );
  });

  it("ignores changed paths that don't match any game", async () => {
    renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    await act(() => {
      triggerWatcherCallback(["/saves/unknown/save.dat"]);
    });

    expect(mockRescanGame).not.toHaveBeenCalled();
  });

  it("watches directories for multiple games", () => {
    renderHook(() => useAutoSync([sims4Game, cyberpunkGame], true), {
      wrapper: createWrapper(),
    });

    expect(mockStartWatching).toHaveBeenCalledWith(
      ["/saves/sims4", "/saves/cyberpunk"],
      expect.any(Function),
    );
  });

  it("cleans up on unmount", () => {
    const { unmount } = renderHook(() => useAutoSync([sims4Game], true), {
      wrapper: createWrapper(),
    });

    vi.clearAllMocks();
    unmount();

    expect(mockStopWatching).toHaveBeenCalled();
    expect(mockCancelAllAutoSyncs).toHaveBeenCalled();
  });
});
