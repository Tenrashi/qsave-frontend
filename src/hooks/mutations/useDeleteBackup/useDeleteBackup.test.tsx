import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDeleteBackup } from "./useDeleteBackup";

const { mockDeleteGameBackup } = vi.hoisted(() => ({
  mockDeleteGameBackup: vi.fn(),
}));

vi.mock("@/operations/drive/backups/backups", () => ({
  deleteGameBackup: mockDeleteGameBackup,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useDeleteBackup", () => {
  it("calls deleteGameBackup with the backup id", async () => {
    mockDeleteGameBackup.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteBackup("The Sims 4"), {
      wrapper: createWrapper(),
    });

    await act(() => result.current.mutateAsync("b1"));

    expect(mockDeleteGameBackup).toHaveBeenCalledWith("b1");
  });

  it("calls onSuccess callback after deletion", async () => {
    mockDeleteGameBackup.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();

    const { result } = renderHook(
      () => useDeleteBackup("The Sims 4", onSuccess),
      { wrapper: createWrapper() },
    );

    await act(() => result.current.mutateAsync("b1"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it("sets error state when deletion fails", async () => {
    mockDeleteGameBackup.mockRejectedValueOnce(new Error("Permission denied"));

    const { result } = renderHook(() => useDeleteBackup("The Sims 4"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync("b1");
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
