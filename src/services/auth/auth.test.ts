import { describe, it, expect, vi, beforeEach } from "vitest";
import { getValidToken, logout } from "./auth";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(),
}));

vi.mock("@/lib/store/store", () => ({
  getAuthState: vi.fn(),
  setAuthState: vi.fn(),
  clearAuth: vi.fn(),
}));

describe("getValidToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns access token when authenticated and not expired", async () => {
    const { getAuthState } = await import("@/lib/store/store");
    vi.mocked(getAuthState).mockResolvedValueOnce({
      isAuthenticated: true,
      accessToken: "valid-token",
      expiresAt: Date.now() + 3_600_000,
    });

    const token = await getValidToken();

    expect(token).toBe("valid-token");
  });

  it("throws when not authenticated", async () => {
    const { getAuthState } = await import("@/lib/store/store");
    vi.mocked(getAuthState).mockResolvedValueOnce({
      isAuthenticated: false,
    });

    await expect(getValidToken()).rejects.toThrow("Not authenticated");
  });
});

describe("logout", () => {
  it("clears auth state from store", async () => {
    const { clearAuth } = await import("@/lib/store/store");
    await logout();

    expect(clearAuth).toHaveBeenCalledOnce();
  });
});
