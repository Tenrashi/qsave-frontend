import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useGames } from "./useGames";

vi.mock("@/operations/scanner/scanner/scanner", () => ({
  scanForGames: vi.fn(() =>
    Promise.resolve([
      { name: "Elden Ring", savePaths: ["/saves/elden"], saveFiles: [] },
    ]),
  ),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useGames", () => {
  it("returns games from scanner", async () => {
    const { result } = renderHook(() => useGames(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe("Elden Ring");
  });
});
