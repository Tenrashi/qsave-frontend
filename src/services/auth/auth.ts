import { fetch } from "@tauri-apps/plugin-http";
import { OAUTH_ENDPOINTS, OAUTH_PARAMS } from "@/lib/constants/constants";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

export type UserInfoResponse = {
  email: string;
};

export const postTokenExchange = async (
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<TokenResponse> => {
  try {
    if (!/^http:\/\/localhost:\d+\/callback$/.test(redirectUri)) {
      throw new Error("Invalid redirect URI");
    }

    const params: Record<string, string> = {
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: OAUTH_PARAMS.grantTypeAuthCode,
    };
    if (codeVerifier) params.code_verifier = codeVerifier;

    const res = await fetch(OAUTH_ENDPOINTS.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });

    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
    return (await res.json()) as TokenResponse;
  } catch (error) {
    throw new Error(
      `Token exchange failed: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};

export const postTokenRefresh = async (
  refreshToken: string,
): Promise<Omit<TokenResponse, "refresh_token">> => {
  try {
    const res = await fetch(OAUTH_ENDPOINTS.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: OAUTH_PARAMS.grantTypeRefresh,
      }).toString(),
    });

    if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
    return (await res.json()) as Omit<TokenResponse, "refresh_token">;
  } catch (error) {
    throw new Error(
      `Token refresh failed: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};

export const postTokenRevoke = async (token: string): Promise<void> => {
  try {
    const res = await fetch(OAUTH_ENDPOINTS.revoke, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });

    if (!res.ok) throw new Error(`Token revocation failed: ${res.status}`);
  } catch (error) {
    throw new Error(
      `Token revocation failed: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};

export const getUserInfo = async (
  accessToken: string,
): Promise<UserInfoResponse> => {
  try {
    const res = await fetch(OAUTH_ENDPOINTS.userInfo, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error(`Failed to fetch user info: ${res.status}`);
    return (await res.json()) as UserInfoResponse;
  } catch (error) {
    throw new Error(
      `Failed to fetch user info: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};
