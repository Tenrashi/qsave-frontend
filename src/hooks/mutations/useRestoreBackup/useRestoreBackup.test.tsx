import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { ReactNode } from "react";
import { RECORD_STATUS, SYNC_STATUS } from "@/domain/types";
import type { Game, SyncRecord } from "@/domain/types";
import { QUERY_KEYS } from "@/lib/constants/constants";
import { useSyncStore } from "@/stores/sync";
import { renderHook, waitFor } from "@/test/test-utils";
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
  mockSaveDeviceSync,
  mockGetCloudGameHash,
  mockRestoreGame,
  mockAddManualGame,
  mockScanManualGame,
  mockGetDeviceId,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockListGameBackups: vi.fn(),
  mockSaveDeviceSync: vi.fn(),
  mockGetCloudGameHash: vi.fn(() =>
    Promise.resolve({ hash: "cloud-hash", syncedAt: "2026-03-14T12:00:00Z" }),
  ),
  mockRestoreGame: vi.fn(),
  mockAddManualGame: vi.fn(),
  mockScanManualGame: vi.fn(),
  mockGetDeviceId: vi.fn(() => Promise.resolve("test-device-id")),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/operations/drive/backups/backups", () => ({
  listGameBackups: mockListGameBackups,
}));

vi.mock("@/operations/devices/devices", () => ({
  saveDeviceSync: mockSaveDeviceSync,
  getCloudGameHash: mockGetCloudGameHash,
}));

vi.mock("@/operations/restore/restore/restore", () => ({
  restoreGame: mockRestoreGame,
}));

vi.mock("@/lib/store/store", () => ({
  addManualGame: mockAddManualGame,
  getDeviceId: mockGetDeviceId,
  setSyncFingerprint: vi.fn(),
}));

vi.mock("@/operations/scanner/scanner/scanner", () => ({
  scanManualGame: mockScanManualGame,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
  return { wrapper, queryClient };
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
      wrapper: createWrapper().wrapper,
    });

    result.current.mutate({ backupId: "b1" });

    await waitFor(() => {
      expect(mockRestoreGame).toHaveBeenCalledWith(sims4Game, "b1", undefined);
    });
  });

  it("resolves latest backup when no id is provided", async () => {
    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper().wrapper,
    });

    result.current.mutate(undefined);

    await waitFor(() => {
      expect(mockListGameBackups).toHaveBeenCalledWith("The Sims 4");
      expect(mockRestoreGame).toHaveBeenCalledWith(sims4Game, "b1", undefined);
    });
  });

  it("sets game status to success and shows success toast after restore", async () => {
    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper().wrapper,
    });

    result.current.mutate({ backupId: "b1" });

    await waitFor(() =>
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.success,
      ),
    );
    expect(mockToastSuccess).toHaveBeenCalledWith("toast.restoreSuccess");
  });

  it("passes targetPaths to restoreGame", async () => {
    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper().wrapper,
    });

    result.current.mutate({
      backupId: "b1",
      targetPaths: ["/saves/custom"],
    });

    await waitFor(() => {
      expect(mockRestoreGame).toHaveBeenCalledWith(sims4Game, "b1", [
        "/saves/custom",
      ]);
    });
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
      wrapper: createWrapper().wrapper,
    });

    result.current.mutate({
      backupId: "b1",
      targetPaths: ["/saves/custom"],
    });

    await waitFor(() => {
      expect(mockAddManualGame).toHaveBeenCalledWith("Cloud Save RPG", [
        "/saves/custom",
      ]);
      expect(mockScanManualGame).toHaveBeenCalledWith("Cloud Save RPG", [
        "/saves/custom",
      ]);
    });
  });

  it("replaces cloud-only game in cache without duplicates", async () => {
    const scannedGame = {
      ...cloudOnlyGame,
      savePaths: ["/saves/custom"],
      saveFiles: [],
      isManual: true,
      isCloudOnly: undefined,
    };
    mockScanManualGame.mockResolvedValue(scannedGame);
    mockAddManualGame.mockResolvedValue(undefined);

    const { wrapper, queryClient } = createWrapper();
    queryClient.setQueryData<Game[]>(QUERY_KEYS.games, [sims4Game]);

    const { result } = renderHook(() => useRestoreBackup(cloudOnlyGame), {
      wrapper,
    });

    result.current.mutate({
      backupId: "b1",
      targetPaths: ["/saves/custom"],
    });

    await waitFor(() => {
      const games = queryClient.getQueryData<Game[]>(QUERY_KEYS.games)!;
      expect(games).toHaveLength(2);
      expect(games.find((game) => game.name === "Cloud Save RPG")).toEqual(
        scannedGame,
      );
    });
  });

  it("does not persist as manual game for local game restore", async () => {
    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper().wrapper,
    });

    result.current.mutate({ backupId: "b1" });

    await waitFor(() => {
      expect(mockRestoreGame).toHaveBeenCalled();
    });

    expect(mockAddManualGame).not.toHaveBeenCalled();
  });

  it("sets error status when post-restore steps fail", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockScanManualGame.mockRejectedValueOnce(new Error("scan failed"));
    mockAddManualGame.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRestoreBackup(cloudOnlyGame), {
      wrapper: createWrapper().wrapper,
    });

    result.current.mutate({
      backupId: "b1",
      targetPaths: ["/saves/custom"],
    });

    await waitFor(() =>
      expect(useSyncStore.getState().gameStatuses["Cloud Save RPG"]).toBe(
        SYNC_STATUS.error,
      ),
    );
    expect(mockToastError).toHaveBeenCalledWith("toast.restoreFailed");
    expect(consoleSpy).toHaveBeenCalledWith(
      "Post-restore update failed:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it("throws when no backups exist and no backupId provided", async () => {
    mockListGameBackups.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper().wrapper,
    });

    result.current.mutate(undefined);

    await waitFor(() =>
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      ),
    );
    expect(mockToastError).toHaveBeenCalledWith("toast.restoreFailed", {
      description: "errors.unknown",
      duration: 10_000,
    });
  });

  it("uses fallback error message when result has no error string", async () => {
    mockRestoreGame.mockResolvedValueOnce({
      ...defaultRecord,
      status: RECORD_STATUS.error,
      error: undefined,
    });

    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper().wrapper,
    });

    result.current.mutate({ backupId: "b1" });

    await waitFor(() =>
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      ),
    );
    expect(mockToastError).toHaveBeenCalledWith("toast.restoreFailed", {
      description: "errors.unknown",
      duration: 10_000,
    });
  });

  it("sets game status to error and shows error toast when restore fails", async () => {
    mockRestoreGame.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper().wrapper,
    });

    result.current.mutate({ backupId: "b1" });

    await waitFor(() =>
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      ),
    );
    expect(mockToastError).toHaveBeenCalledWith("toast.restoreFailed", {
      description: "errors.networkError",
      duration: 10_000,
    });
  });

  it("shows classified error toast when restore rejects with a non-Error value", async () => {
    mockRestoreGame.mockRejectedValueOnce("403 Forbidden quota exceeded");

    const { result } = renderHook(() => useRestoreBackup(sims4Game), {
      wrapper: createWrapper().wrapper,
    });

    result.current.mutate({ backupId: "b1" });

    await waitFor(() =>
      expect(useSyncStore.getState().gameStatuses["The Sims 4"]).toBe(
        SYNC_STATUS.error,
      ),
    );
    expect(mockToastError).toHaveBeenCalledWith("toast.restoreFailed", {
      description: "errors.forbidden",
      duration: 10_000,
    });
  });
});
