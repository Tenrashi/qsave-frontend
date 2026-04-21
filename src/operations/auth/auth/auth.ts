import { invoke } from "@tauri-apps/api/core";
import type { AuthState } from "@/domain/types";
import { setAuthState, clearAuth } from "@/lib/store/store";
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
  postTokenRevoke,
  getUserInfo,
} from "@/services/auth/auth";
import { generateCodeVerifier, generateCodeChallenge } from "@/lib/pkce/pkce";
import { useAuthStore } from "@/stores/auth";
import { notify } from "@/lib/notify/notify";
import i18n from "@/i18n";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = "https://www.googleapis.com/auth/drive.file email";

type OAuthResult = {
  code: string;
  redirect_uri: string;
};

export const startOAuthFlow = async (): Promise<AuthState> => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const oauthState = crypto.randomUUID();

  const authUrl = new URL(OAUTH_ENDPOINTS.auth);
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", OAUTH_PARAMS.accessTypeOffline);
  authUrl.searchParams.set("prompt", OAUTH_PARAMS.promptConsent);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", oauthState);

  const result: OAuthResult = await invoke(TAURI_COMMANDS.startOAuth, {
    authUrlBase: authUrl.toString(),
    expectedState: oauthState,
    successMessage: i18n.t("auth.oauthSuccess"),
    stateMismatchMessage: i18n.t("auth.oauthStateMismatch"),
  });

  return exchangeCodeForTokens(result.code, result.redirect_uri, codeVerifier);
};

export const exchangeCodeForTokens = async (
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<AuthState> => {
  const data = await postTokenExchange(code, redirectUri, codeVerifier);
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
  const auth = useAuthStore.getState().auth;
  if (!auth.refreshToken) throw new Error("No refresh token");

  try {
    const data = await postTokenRefresh(auth.refreshToken);

    const updated: AuthState = {
      ...auth,
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    await setAuthState(updated);
    useAuthStore.setState({ auth: updated });
    return updated;
  } catch (error) {
    await useAuthStore.getState().logout();
    notify(APP_NAME, i18n.t("notifications.sessionExpired"));
    throw error;
  }
};

export const getValidToken = async (): Promise<string> => {
  const auth = useAuthStore.getState().auth;
  if (!auth.isAuthenticated || (!auth.accessToken && !auth.refreshToken)) {
    throw new Error("Not authenticated");
  }

  const expiring =
    auth.expiresAt !== undefined &&
    auth.expiresAt - Date.now() < TOKEN_EXPIRY_BUFFER_MS;

  if (!auth.accessToken || expiring) {
    const refreshed = await refreshAccessToken();
    if (refreshed.accessToken) return refreshed.accessToken;
    if (auth.accessToken) return auth.accessToken;
    throw new Error("Not authenticated");
  }

  return auth.accessToken;
};

export const logout = async (): Promise<void> => {
  const auth = useAuthStore.getState().auth;
  const token = auth.refreshToken ?? auth.accessToken;
  if (token) {
    await postTokenRevoke(token).catch(() => {});
  }
  await clearAuth();
};
