import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { sims4Game } from "@/test/mocks/games";
import { useAutoSync } from "./useAutoSync";

const {
  mockStartWatching,
  mockStopWatching,
  mockScheduleAutoSync,
  mockCancelAllAutoSyncs,
  mockSyncGame,
  mockRescanGame,
} = vi.hoisted(() => ({
  mockStartWatching: vi.fn(),
  mockStopWatching: vi.fn(),
  mockScheduleAutoSync: vi.fn(),
  mockCancelAllAutoSyncs: vi.fn(),
  mockSyncGame: vi.fn(),
  mockRescanGame: vi.fn(),
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

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useAutoSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ auth: { isAuthenticated: false }, loading: false });
    useSyncStore.setState({ gameStatuses: {}, watchedGames: {}, syncFingerprints: {} });
  });

  it("stops watching when disabled", async () => {
    renderHook(() => useAutoSync([sims4Game], false), { wrapper: createWrapper() });

    expect(mockStopWatching).toHaveBeenCalled();
    expect(mockCancelAllAutoSyncs).toHaveBeenCalled();
  });

  it("starts watching when enabled with games", async () => {
    renderHook(() => useAutoSync([sims4Game], true), { wrapper: createWrapper() });

    expect(mockStartWatching).toHaveBeenCalledWith(
      ["/saves/sims4"],
      expect.any(Function),
    );
  });

  it("stops watching when no games", async () => {
    renderHook(() => useAutoSync([], true), { wrapper: createWrapper() });

    expect(mockStopWatching).toHaveBeenCalled();
  });
});
