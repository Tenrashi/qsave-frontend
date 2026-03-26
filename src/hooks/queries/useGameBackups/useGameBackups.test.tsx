import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { mockBackups } from "@/test/mocks/drive";
import { useGameBackups } from "./useGameBackups";

const { mockListGameBackups } = vi.hoisted(() => ({
  mockListGameBackups: vi.fn(),
}));

vi.mock("@/operations/drive/backups/backups", () => ({
  listGameBackups: mockListGameBackups,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useGameBackups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns backups for a game", async () => {
    mockListGameBackups.mockResolvedValueOnce(mockBackups);

    const { result } = renderHook(() => useGameBackups("The Sims 4", true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockBackups);
    expect(mockListGameBackups).toHaveBeenCalledWith("The Sims 4");
  });

  it("does not fetch when disabled", () => {
    const { result } = renderHook(() => useGameBackups("The Sims 4", false), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockListGameBackups).not.toHaveBeenCalled();
  });
});
