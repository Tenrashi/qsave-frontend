import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuthStore } from "./auth";

const { mockGetAuthState, mockClearAuth, mockStartOAuthFlow } = vi.hoisted(
  () => ({
    mockGetAuthState: vi.fn(),
    mockClearAuth: vi.fn(),
    mockStartOAuthFlow: vi.fn(),
  }),
);

vi.mock("@/lib/store/store", () => ({
  getAuthState: mockGetAuthState,
  clearAuth: mockClearAuth,
}));

vi.mock("@/operations/auth/auth/auth", () => ({
  startOAuthFlow: mockStartOAuthFlow,
}));

describe("useAuthStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      auth: { isAuthenticated: false },
      loading: true,
      error: null,
    });
  });

  describe("init", () => {
    it("loads persisted auth state", async () => {
      const auth = { isAuthenticated: true, email: "test@test.com" };
      mockGetAuthState.mockResolvedValueOnce(auth);

      await useAuthStore.getState().init();

      expect(useAuthStore.getState().auth).toEqual(auth);
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it("defaults to unauthenticated on error", async () => {
      mockGetAuthState.mockRejectedValueOnce(new Error("fail"));

      await useAuthStore.getState().init();

      expect(useAuthStore.getState().auth).toEqual({ isAuthenticated: false });
      expect(useAuthStore.getState().loading).toBe(false);
    });
  });

  describe("login", () => {
    it("sets auth state on successful OAuth", async () => {
      const auth = { isAuthenticated: true, email: "user@test.com" };
      mockStartOAuthFlow.mockResolvedValueOnce(auth);

      await useAuthStore.getState().login();

      expect(useAuthStore.getState().auth).toEqual(auth);
      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
    });

    it("sets error on OAuth failure", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockStartOAuthFlow.mockRejectedValueOnce(new Error("OAuth denied"));

      await useAuthStore.getState().login();

      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().error).toBe("OAuth denied");
      consoleSpy.mockRestore();
    });

    it("handles non-Error rejection", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockStartOAuthFlow.mockRejectedValueOnce("string error");

      await useAuthStore.getState().login();

      expect(useAuthStore.getState().error).toBe("string error");
      consoleSpy.mockRestore();
    });
  });

  describe("logout", () => {
    it("clears auth and resets state", async () => {
      useAuthStore.setState({
        auth: { isAuthenticated: true, email: "test@test.com" },
      });

      await useAuthStore.getState().logout();

      expect(mockClearAuth).toHaveBeenCalledOnce();
      expect(useAuthStore.getState().auth).toEqual({ isAuthenticated: false });
    });

    it("resets state even if clearAuth fails", async () => {
      mockClearAuth.mockRejectedValueOnce(new Error("fail"));
      useAuthStore.setState({
        auth: { isAuthenticated: true, email: "test@test.com" },
      });

      await expect(useAuthStore.getState().logout()).rejects.toThrow("fail");

      expect(useAuthStore.getState().auth).toEqual({ isAuthenticated: false });
    });
  });
});
