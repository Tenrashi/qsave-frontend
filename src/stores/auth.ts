import { create } from "zustand";
import type { AuthState } from "@/domain/types";
import { getAuthState, clearAuth } from "@/lib/store/store";
import { startOAuthFlow } from "@/services/auth/auth";

type AuthStore = {
  auth: AuthState;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  auth: { isAuthenticated: false },
  loading: true,
  error: null,

  init: async () => {
    try {
      const state = await getAuthState();
      set({ auth: state, loading: false });
    } catch {
      set({ auth: { isAuthenticated: false }, loading: false });
    }
  },

  login: async () => {
    set({ loading: true, error: null });
    try {
      const state = await startOAuthFlow();
      set({ auth: state, loading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("OAuth login failed:", message);
      set({ loading: false, error: message });
    }
  },

  logout: async () => {
    try {
      await clearAuth();
    } finally {
      set({ auth: { isAuthenticated: false } });
    }
  },
}));
