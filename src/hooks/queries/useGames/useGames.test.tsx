import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@/test/test-utils";
import { useGames } from "./useGames";
import type { Game } from "@/domain/types";

const { mockScanForGames, mockLoadCachedGames, mockToastError } = vi.hoisted(
  () => ({
    mockScanForGames: vi.fn(
      (): Promise<Game[]> =>
        Promise.resolve([
          { name: "Elden Ring", savePaths: ["/saves/elden"], saveFiles: [] },
        ]),
    ),
    mockLoadCachedGames: vi.fn((): Promise<Game[]> => Promise.resolve([])),
    mockToastError: vi.fn(),
  }),
);

vi.mock("@/operations/scanner/scanner/scanner", () => ({
  scanForGames: mockScanForGames,
  loadCachedGames: mockLoadCachedGames,
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

describe("useGames", () => {
  it("returns games from scanner", async () => {
    const { result } = renderHook(() => useGames());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe("Elden Ring");
  });

  it("shows cached games as placeholder while scan is pending", async () => {
    let resolveScan!: (value: Game[]) => void;
    mockScanForGames.mockImplementation(
      () =>
        new Promise<Game[]>((resolve) => {
          resolveScan = resolve;
        }),
    );
    mockLoadCachedGames.mockResolvedValue([
      { name: "Cached Game", savePaths: ["/saves/cached"], saveFiles: [] },
    ]);

    const { result } = renderHook(() => useGames());

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data![0].name).toBe("Cached Game");
    expect(result.current.isPlaceholderData).toBe(true);

    resolveScan([
      { name: "Fresh Game", savePaths: ["/saves/fresh"], saveFiles: [] },
    ]);

    await waitFor(() =>
      expect(result.current.data![0].name).toBe("Fresh Game"),
    );
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it("shows error toast when scan fails", async () => {
    mockScanForGames.mockRejectedValue(new Error("scan failed"));

    renderHook(() => useGames());

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("toast.scanFailed", {
        description: "scan failed",
      }),
    );
  });
});
