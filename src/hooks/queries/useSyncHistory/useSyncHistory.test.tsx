import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSyncHistory } from "./useSyncHistory";

vi.mock("@/lib/store/store", () => ({
  getSyncHistory: vi.fn(() =>
    Promise.resolve([
      {
        id: "1",
        gameName: "The Sims 4",
        fileName: "The Sims 4.zip",
        syncedAt: new Date(),
        driveFileId: "abc",
        revisionCount: 1,
        status: "success",
      },
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

describe("useSyncHistory", () => {
  it("returns sync history from store", async () => {
    const { result } = renderHook(() => useSyncHistory(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].gameName).toBe("The Sims 4");
  });
});
