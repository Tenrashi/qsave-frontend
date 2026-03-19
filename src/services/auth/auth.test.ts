import { describe, it, expect, vi, beforeEach } from "vitest";
import { getValidToken, logout } from "./auth";

const { mockGetAuthState, mockSetAuthState, mockClearAuth } = vi.hoisted(() => ({
  mockGetAuthState: vi.fn(),
  mockSetAuthState: vi.fn(),
  mockClearAuth: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(),
}));

vi.mock("@/lib/store/store", () => ({
  getAuthState: mockGetAuthState,
  setAuthState: mockSetAuthState,
  clearAuth: mockClearAuth,
}));

describe("getValidToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns access token when authenticated and not expired", async () => {
    mockGetAuthState.mockResolvedValueOnce({
      isAuthenticated: true,
      accessToken: "valid-token",
      expiresAt: Date.now() + 3_600_000,
    });

    const token = await getValidToken();

    expect(token).toBe("valid-token");
  });

  it("throws when not authenticated", async () => {
    mockGetAuthState.mockResolvedValueOnce({
      isAuthenticated: false,
    });

    await expect(getValidToken()).rejects.toThrow("Not authenticated");
  });
});

describe("logout", () => {
  it("clears auth state from store", async () => {
    await logout();

    expect(mockClearAuth).toHaveBeenCalledOnce();
  });
});
