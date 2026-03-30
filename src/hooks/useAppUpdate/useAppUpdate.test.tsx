import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, screen, setupUser } from "@/test/test-utils";
import { render } from "@testing-library/react";
import { useAppUpdate } from "./useAppUpdate";

const { mockCheck, mockRelaunch } = vi.hoisted(() => ({
  mockCheck: vi.fn(),
  mockRelaunch: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: mockCheck,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: mockRelaunch,
}));

const InstallHarness = () => {
  const { status, error, install } = useAppUpdate();
  return (
    <div>
      <span>{status}</span>
      {error && <span>{error}</span>}
      <button onClick={install}>install</button>
    </div>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAppUpdate", () => {
  it("stays idle when no update is available", async () => {
    mockCheck.mockResolvedValue(null);

    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(result.current.status).toBe("idle");
    });
    expect(result.current.version).toBeNull();
  });

  it("sets status to available when an update exists", async () => {
    mockCheck.mockResolvedValue({
      version: "1.2.0",
      downloadAndInstall: vi.fn(),
    });

    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(result.current.status).toBe("available");
    });
    expect(result.current.version).toBe("1.2.0");
  });

  it("sets error status when check fails", async () => {
    mockCheck.mockRejectedValue(new Error("network timeout"));

    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.error).toBe("network timeout");
  });

  it("handles non-Error throw in check", async () => {
    mockCheck.mockRejectedValue("string error");

    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.error).toBe("string error");
  });

  it("does nothing when install is called without an update", async () => {
    mockCheck.mockResolvedValue(null);

    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => {
      expect(result.current.status).toBe("idle");
    });

    result.current.install();

    expect(result.current.status).toBe("idle");
  });

  it("downloads, installs, and relaunches on install", async () => {
    const mockDownloadAndInstall = vi.fn(
      (callback: (event: { event: string }) => void) => {
        callback({ event: "Started" });
        callback({ event: "Finished" });
        return Promise.resolve();
      },
    );
    mockCheck.mockResolvedValue({
      version: "2.0.0",
      downloadAndInstall: mockDownloadAndInstall,
    });
    mockRelaunch.mockResolvedValue(undefined);
    const user = setupUser();

    render(<InstallHarness />);

    await waitFor(() => {
      expect(screen.getByText("available")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "install" }));

    await waitFor(() => {
      expect(mockRelaunch).toHaveBeenCalledOnce();
    });
    expect(mockDownloadAndInstall).toHaveBeenCalledOnce();
  });

  it("handles non-Error throw in install", async () => {
    const mockDownloadAndInstall = vi.fn().mockRejectedValue("install boom");
    mockCheck.mockResolvedValue({
      version: "2.0.0",
      downloadAndInstall: mockDownloadAndInstall,
    });
    const user = setupUser();

    render(<InstallHarness />);

    await waitFor(() => {
      expect(screen.getByText("available")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "install" }));

    await waitFor(() => {
      expect(screen.getByText("error")).toBeInTheDocument();
    });
    expect(screen.getByText("install boom")).toBeInTheDocument();
  });

  it("sets error status when install fails", async () => {
    const mockDownloadAndInstall = vi
      .fn()
      .mockRejectedValue(new Error("disk full"));
    mockCheck.mockResolvedValue({
      version: "2.0.0",
      downloadAndInstall: mockDownloadAndInstall,
    });
    const user = setupUser();

    render(<InstallHarness />);

    await waitFor(() => {
      expect(screen.getByText("available")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "install" }));

    await waitFor(() => {
      expect(screen.getByText("error")).toBeInTheDocument();
    });
    expect(screen.getByText("disk full")).toBeInTheDocument();
  });
});
