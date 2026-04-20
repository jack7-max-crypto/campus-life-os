import "server-only";

import { NextResponse } from "next/server";
import type {
  CanvasConnectionMode,
  CanvasStatusResponse,
} from "@/lib/integrations/canvas/types";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type CanvasServerConfig = {
  baseUrl: string | null;
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  devAccessToken: string | null;
};

type CanvasTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type CanvasTokenBundle = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
};

export const CANVAS_ACCESS_TOKEN_COOKIE = "campus-life-os.canvas.access-token";
export const CANVAS_REFRESH_TOKEN_COOKIE = "campus-life-os.canvas.refresh-token";
export const CANVAS_TOKEN_EXPIRES_AT_COOKIE = "campus-life-os.canvas.token-expires-at";
export const CANVAS_OAUTH_STATE_COOKIE = "campus-life-os.canvas.oauth-state";

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizeBaseUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const normalized = new URL(value);
    normalized.pathname = normalized.pathname.replace(/\/+$/, "");
    normalized.search = "";
    normalized.hash = "";
    return normalized.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

function createTokenRequestBody(
  values: Record<string, string | number | undefined | null>,
): URLSearchParams {
  const body = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value == null || value === "") {
      return;
    }

    body.set(key, String(value));
  });

  return body;
}

export function getCanvasServerConfig(): CanvasServerConfig {
  return {
    baseUrl: normalizeBaseUrl(getOptionalEnv("CANVAS_BASE_URL")),
    clientId: getOptionalEnv("CANVAS_CLIENT_ID"),
    clientSecret: getOptionalEnv("CANVAS_CLIENT_SECRET"),
    redirectUri: getOptionalEnv("CANVAS_REDIRECT_URI"),
    devAccessToken: getOptionalEnv("CANVAS_DEV_ACCESS_TOKEN"),
  };
}

export function hasCanvasOauthConfig(config = getCanvasServerConfig()) {
  return Boolean(config.baseUrl && config.clientId && config.clientSecret && config.redirectUri);
}

export function getCanvasTokenBundle(cookieReader: CookieReader): CanvasTokenBundle {
  const expiresAtValue = cookieReader.get(CANVAS_TOKEN_EXPIRES_AT_COOKIE)?.value ?? null;
  const expiresAt = expiresAtValue ? Number(expiresAtValue) : null;

  return {
    accessToken: cookieReader.get(CANVAS_ACCESS_TOKEN_COOKIE)?.value ?? null,
    refreshToken: cookieReader.get(CANVAS_REFRESH_TOKEN_COOKIE)?.value ?? null,
    expiresAt: expiresAt && Number.isFinite(expiresAt) ? expiresAt : null,
  };
}

export function getCanvasOauthState(cookieReader: CookieReader) {
  return cookieReader.get(CANVAS_OAUTH_STATE_COOKIE)?.value ?? null;
}

export function getCanvasBaseUrlHost(config = getCanvasServerConfig()) {
  if (!config.baseUrl) {
    return null;
  }

  try {
    return new URL(config.baseUrl).host;
  } catch {
    return null;
  }
}

export function getCanvasStatusResponse(cookieReader: CookieReader): CanvasStatusResponse {
  const config = getCanvasServerConfig();
  const tokens = getCanvasTokenBundle(cookieReader);
  const oauthConfigured = hasCanvasOauthConfig(config);
  const hasOauthTokens = Boolean(tokens.accessToken || tokens.refreshToken);
  const hasDevToken = Boolean(config.devAccessToken);
  const mode: CanvasConnectionMode = hasOauthTokens
    ? "oauth"
    : hasDevToken
      ? "dev-token"
      : oauthConfigured
        ? "oauth"
        : "unconfigured";

  const isConfigured = oauthConfigured || hasDevToken;
  const isConnected = hasOauthTokens || hasDevToken;

  let setupMessage = "Add Canvas credentials to begin syncing.";
  if (hasOauthTokens) {
    setupMessage = "Canvas is connected with OAuth tokens stored server-side.";
  } else if (hasDevToken) {
    setupMessage = "Canvas sync is enabled through a server-side development token.";
  } else if (oauthConfigured) {
    setupMessage = "OAuth is configured. Connect Canvas to start importing data.";
  }

  return {
    mode,
    isConfigured,
    oauthConfigured,
    isConnected,
    canSync: isConnected,
    connectUrl: oauthConfigured ? "/api/canvas/connect" : null,
    disconnectUrl: hasOauthTokens ? "/api/canvas/disconnect" : null,
    baseUrlHost: getCanvasBaseUrlHost(config),
    setupMessage,
  };
}

export function getCanvasAuthorizationUrl(state: string, config = getCanvasServerConfig()) {
  if (!hasCanvasOauthConfig(config)) {
    return null;
  }

  const baseUrl = config.baseUrl;
  if (!baseUrl) {
    return null;
  }

  const url = new URL("/login/oauth2/auth", baseUrl);
  url.searchParams.set("client_id", config.clientId!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", config.redirectUri!);
  return url.toString();
}

async function requestCanvasTokens(
  body: URLSearchParams,
  config = getCanvasServerConfig(),
): Promise<CanvasTokenResponse> {
  if (!hasCanvasOauthConfig(config)) {
    throw new Error("Canvas OAuth is not configured.");
  }

  const baseUrl = config.baseUrl;
  if (!baseUrl) {
    throw new Error("Canvas base URL is not configured.");
  }

  const response = await fetch(new URL("/login/oauth2/token", baseUrl), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(bodyText || `Canvas token request failed with status ${response.status}.`);
  }

  return (await response.json()) as CanvasTokenResponse;
}

export function setCanvasOauthStateCookie(response: NextResponse, state: string) {
  response.cookies.set(CANVAS_OAUTH_STATE_COOKIE, state, getCookieOptions(60 * 10));
}

export function clearCanvasOauthStateCookie(response: NextResponse) {
  response.cookies.set(CANVAS_OAUTH_STATE_COOKIE, "", getCookieOptions(0));
}

export function setCanvasTokenCookies(response: NextResponse, tokens: CanvasTokenResponse) {
  const accessTokenMaxAge = Math.max(60, tokens.expires_in ?? 3600);
  response.cookies.set(
    CANVAS_ACCESS_TOKEN_COOKIE,
    tokens.access_token,
    getCookieOptions(accessTokenMaxAge),
  );

  if (tokens.refresh_token) {
    response.cookies.set(
      CANVAS_REFRESH_TOKEN_COOKIE,
      tokens.refresh_token,
      getCookieOptions(60 * 60 * 24 * 30),
    );
  }

  response.cookies.set(
    CANVAS_TOKEN_EXPIRES_AT_COOKIE,
    String(Date.now() + accessTokenMaxAge * 1000),
    getCookieOptions(accessTokenMaxAge),
  );
}

export function clearCanvasTokenCookies(response: NextResponse) {
  response.cookies.set(CANVAS_ACCESS_TOKEN_COOKIE, "", getCookieOptions(0));
  response.cookies.set(CANVAS_REFRESH_TOKEN_COOKIE, "", getCookieOptions(0));
  response.cookies.set(CANVAS_TOKEN_EXPIRES_AT_COOKIE, "", getCookieOptions(0));
}

export async function exchangeCanvasCodeForTokens(
  code: string,
  config = getCanvasServerConfig(),
) {
  return requestCanvasTokens(
    createTokenRequestBody({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
    config,
  );
}

export async function refreshCanvasAccessToken(
  refreshToken: string,
  config = getCanvasServerConfig(),
) {
  return requestCanvasTokens(
    createTokenRequestBody({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
    config,
  );
}
