import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@/test/test-utils";
import { useDeleteBackup } from "./useDeleteBackup";

const { mockDeleteGameBackup, mockToastSuccess, mockToastError } = vi.hoisted(
  () => ({
    mockDeleteGameBackup: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }),
);

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
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

    await result.current.mutateAsync("b1");

    expect(mockDeleteGameBackup).toHaveBeenCalledWith("b1");
  });

  it("calls onSuccess callback and shows success toast after deletion", async () => {
    mockDeleteGameBackup.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();

    const { result } = renderHook(
      () => useDeleteBackup("The Sims 4", onSuccess),
      { wrapper: createWrapper() },
    );

    await result.current.mutateAsync("b1");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(mockToastSuccess).toHaveBeenCalledWith("toast.deleteSuccess");
  });

  it("sets error state and shows error toast when deletion fails", async () => {
    mockDeleteGameBackup.mockRejectedValueOnce(new Error("Permission denied"));

    const { result } = renderHook(() => useDeleteBackup("The Sims 4"), {
      wrapper: createWrapper(),
    });

    result.current.mutate("b1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith("toast.deleteFailed", {
      description: "errors.unknown",
      duration: 10_000,
    });
  });

  it("shows classified error toast when deletion rejects with a non-Error value", async () => {
    mockDeleteGameBackup.mockRejectedValueOnce("403 Forbidden quota exceeded");

    const { result } = renderHook(() => useDeleteBackup("The Sims 4"), {
      wrapper: createWrapper(),
    });

    result.current.mutate("b1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith("toast.deleteFailed", {
      description: "errors.forbidden",
      duration: 10_000,
    });
  });
});
