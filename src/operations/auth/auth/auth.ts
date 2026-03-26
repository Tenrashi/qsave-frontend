import { invoke } from "@tauri-apps/api/core";
import type { AuthState } from "@/domain/types";
import { getAuthState, setAuthState, clearAuth } from "@/lib/store/store";
import {
  TAURI_COMMANDS,
  TOKEN_EXPIRY_BUFFER_MS,
  APP_NAME,
  OAUTH_ENDPOINTS,
  OAUTH_PARAMS,
} from "@/lib/constants/constants";
import {
  postTokenExchange,
  postTokenRefresh,
  getUserInfo,
} from "@/services/auth/auth";
import { useAuthStore } from "@/stores/auth";
import { notify } from "@/lib/notify/notify";
import i18n from "@/i18n";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = "https://www.googleapis.com/auth/drive.file email";

export const startOAuthFlow = async (): Promise<AuthState> => {
  const redirectUri: string = await invoke(TAURI_COMMANDS.getOAuthRedirectUri);

  const authUrl = new URL(OAUTH_ENDPOINTS.auth);
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", OAUTH_PARAMS.accessTypeOffline);
  authUrl.searchParams.set("prompt", OAUTH_PARAMS.promptConsent);

  const code: string = await invoke(TAURI_COMMANDS.startOAuth, {
    authUrl: authUrl.toString(),
  });
  return exchangeCodeForTokens(code, redirectUri);
};

export const exchangeCodeForTokens = async (
  code: string,
  redirectUri?: string,
): Promise<AuthState> => {
  const uri =
    redirectUri ?? (await invoke<string>(TAURI_COMMANDS.getOAuthRedirectUri));

  const data = await postTokenExchange(code, uri);
  const user = await getUserInfo(data.access_token);

  const auth: AuthState = {
    isAuthenticated: true,
    email: user.email,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  await setAuthState(auth);
  return auth;
};

export const refreshAccessToken = async (): Promise<AuthState> => {
  const auth = await getAuthState();
  if (!auth.refreshToken) throw new Error("No refresh token");

  try {
    const data = await postTokenRefresh(auth.refreshToken);

    const updated: AuthState = {
      ...auth,
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    await setAuthState(updated);
    return updated;
  } catch (error) {
    await useAuthStore.getState().logout();
    notify(APP_NAME, i18n.t("notifications.sessionExpired"));
    throw error;
  }
};

export const getValidToken = async (): Promise<string> => {
  const auth = await getAuthState();
  if (!auth.isAuthenticated || !auth.accessToken) {
    throw new Error("Not authenticated");
  }

  if (auth.expiresAt && auth.expiresAt - Date.now() < TOKEN_EXPIRY_BUFFER_MS) {
    const refreshed = await refreshAccessToken();
    return refreshed.accessToken ?? auth.accessToken;
  }

  return auth.accessToken;
};

export const logout = async (): Promise<void> => {
  await clearAuth();
};
