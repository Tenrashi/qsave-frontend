import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { ReactNode } from "react";
import { RECORD_STATUS, SYNC_STATUS } from "@/domain/types";
import type { SyncRecord } from "@/domain/types";
import { useSyncStore } from "@/stores/sync";
import { sims4Game, cloudOnlyGame } from "@/test/mocks/games";
import { mockBackups } from "@/test/mocks/drive";
import { useRestoreBackup } from "./useRestoreBackup";

i18n.use(initReactI18next).init({
  lng: "cimode",
  resources: {},
  interpolation: { escapeValue: false },
  showSupportNotice: false,
});

const defaultRecord: SyncRecord = {
  id: "r1",
  gameName: "The Sims 4",
  fileName: "The Sims 4.zip",
  syncedAt: new Date(),
  driveFileId: "b1",
  revisionCount: 3,
  status: RECORD_STATUS.success,
  type: "restore",
};

const {
  mockListGameBackups,
  mockRestoreGame,
  mockAddManualGame,
  mockScanManualGame,
} = vi.hoisted(() => ({
  mockListGameBackups: vi.fn(),
  mockRestoreGame: vi.fn(),
  mockAddManualGame: vi.fn(),
  mockScanManualGame: vi.fn(),
}));

vi.mock("@/services/drive/drive", () => ({
  listGameBackups: mockListGameBackups,
}));

vi.mock("@/services/restore/restore", () => ({
  restoreGame: mockRestoreGame,
}));

vi.mock("@/lib/store/store", () => ({
  addManualGame: mockAddManualGame,
  setSyncFingerprint: vi.fn(),
}));

vi.mock("@/services/scanner/scanner", () => ({
  scanManualGame: mockScanManualGame,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
};

describe("useRestoreBackup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRestoreGame.mockResolvedValue(defaultRecord);
    mockListGameBackups.mockResolvedValue(mockBackups);
    useSyncStore.setState({ gameStatuses: {}, syncFingerprints: {} });
  });

  it("restores a backup by id", async () => {
    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper(),
    });

    await act(() => result.current.mutateAsync({ backupId: "b1" }));

    expect(mockRestoreGame).toHaveBeenCalledWith(sims4Game, "b1", undefined);
  });

  it("resolves latest backup when no id is provided", async () => {
    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper(),
    });

    await act(() => result.current.mutateAsync(undefined));

    expect(mockListGameBackups).toHaveBeenCalledWith("The Sims 4");
    expect(mockRestoreGame).toHaveBeenCalledWith(sims4Game, "b1", undefined);
  });

  it("sets game status to success after restore", async () => {
    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper(),
    });

    await act(() => result.current.mutateAsync({ backupId: "b1" }));

    await waitFor(() => {
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.success,
      );
    });
  });

  it("passes targetPaths to restoreGame", async () => {
    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper(),
    });

    await act(() =>
      result.current.mutateAsync({
        backupId: "b1",
        targetPaths: ["/saves/custom"],
      }),
    );

    expect(mockRestoreGame).toHaveBeenCalledWith(sims4Game, "b1", [
      "/saves/custom",
    ]);
  });

  it("persists cloud-only game as manual after restore", async () => {
    const scannedGame = {
      ...cloudOnlyGame,
      savePaths: ["/saves/custom"],
      saveFiles: [],
      isManual: true,
    };
    mockScanManualGame.mockResolvedValue(scannedGame);
    mockAddManualGame.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRestoreBackup(cloudOnlyGame), {
      wrapper: createWrapper(),
    });

    await act(() =>
      result.current.mutateAsync({
        backupId: "b1",
        targetPaths: ["/saves/custom"],
      }),
    );

    await waitFor(() => {
      expect(mockAddManualGame).toHaveBeenCalledWith("Cloud Save RPG", [
        "/saves/custom",
      ]);
      expect(mockScanManualGame).toHaveBeenCalledWith("Cloud Save RPG", [
        "/saves/custom",
      ]);
    });
  });

  it("does not persist as manual game for local game restore", async () => {
    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper(),
    });

    await act(() => result.current.mutateAsync({ backupId: "b1" }));

    await waitFor(() => {
      expect(mockAddManualGame).not.toHaveBeenCalled();
    });
  });

  it("sets game status to error when restore fails", async () => {
    mockRestoreGame.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ backupId: "b1" });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      );
    });
  });
});
