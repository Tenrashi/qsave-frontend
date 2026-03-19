import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { sims4Game } from "@/test/mocks/games";
import { useAutoSync } from "./useAutoSync";

vi.mock("@/lib/watcher/watcher", () => ({
  startWatching: vi.fn(),
  stopWatching: vi.fn(),
}));

vi.mock("@/lib/autoSync/autoSync", () => ({
  scheduleAutoSync: vi.fn(),
  cancelAllAutoSyncs: vi.fn(),
}));

vi.mock("@/services/sync/sync", () => ({
  syncGame: vi.fn(),
}));

vi.mock("@/services/scanner/scanner", () => ({
  rescanGame: vi.fn(),
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
    const { stopWatching } = await import("@/lib/watcher/watcher");
    const { cancelAllAutoSyncs } = await import("@/lib/autoSync/autoSync");

    renderHook(() => useAutoSync([sims4Game], false), { wrapper: createWrapper() });

    expect(stopWatching).toHaveBeenCalled();
    expect(cancelAllAutoSyncs).toHaveBeenCalled();
  });

  it("starts watching when enabled with games", async () => {
    const { startWatching } = await import("@/lib/watcher/watcher");

    renderHook(() => useAutoSync([sims4Game], true), { wrapper: createWrapper() });

    expect(startWatching).toHaveBeenCalledWith(
      ["/saves/sims4"],
      expect.any(Function),
    );
  });

  it("stops watching when no games", async () => {
    const { stopWatching } = await import("@/lib/watcher/watcher");

    renderHook(() => useAutoSync([], true), { wrapper: createWrapper() });

    expect(stopWatching).toHaveBeenCalled();
  });
});
