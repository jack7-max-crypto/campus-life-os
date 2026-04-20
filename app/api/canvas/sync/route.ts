import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getCanvasServerConfig,
  getCanvasTokenBundle,
  hasCanvasOauthConfig,
  refreshCanvasAccessToken,
  setCanvasTokenCookies,
} from "@/lib/integrations/canvas/auth";
import { CanvasApiError } from "@/lib/integrations/canvas/client";
import { syncCanvasData } from "@/lib/integrations/canvas/sync";
import type { CanvasSyncResult } from "@/lib/integrations/canvas/types";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST() {
  const config = getCanvasServerConfig();
  const cookieStore = await cookies();
  const tokens = getCanvasTokenBundle(cookieStore);

  if (!config.baseUrl) {
    return errorResponse("CANVAS_BASE_URL is missing or invalid.", 503);
  }

  let accessToken = tokens.accessToken;
  let connectionMode: CanvasSyncResult["connectionMode"] | null = null;
  let refreshedTokens: Awaited<ReturnType<typeof refreshCanvasAccessToken>> | null = null;

  if (accessToken) {
    connectionMode = "oauth";
  } else if (tokens.refreshToken && hasCanvasOauthConfig(config)) {
    refreshedTokens = await refreshCanvasAccessToken(tokens.refreshToken, config);
    accessToken = refreshedTokens.access_token;
    connectionMode = "oauth";
  } else if (config.devAccessToken) {
    accessToken = config.devAccessToken;
    connectionMode = "dev-token";
  } else {
    return errorResponse("Canvas is not connected. Complete setup before syncing.", 401);
  }

  try {
    const result = await syncCanvasData({
      baseUrl: config.baseUrl,
      accessToken,
      connectionMode,
    });
    const response = NextResponse.json(
      { result },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );

    if (refreshedTokens) {
      setCanvasTokenCookies(response, refreshedTokens);
    }

    return response;
  } catch (error) {
    if (
      error instanceof CanvasApiError &&
      error.status === 401 &&
      tokens.refreshToken &&
      hasCanvasOauthConfig(config)
    ) {
      const retryTokens = await refreshCanvasAccessToken(tokens.refreshToken, config);
      const result = await syncCanvasData({
        baseUrl: config.baseUrl,
        accessToken: retryTokens.access_token,
        connectionMode: "oauth",
      });
      const response = NextResponse.json(
        { result },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
      setCanvasTokenCookies(response, retryTokens);
      return response;
    }

    if (error instanceof CanvasApiError) {
      return errorResponse(error.body ?? "Canvas API request failed.", error.status);
    }

    const message = error instanceof Error ? error.message : "Canvas sync failed.";
    return errorResponse(message, 500);
  }
}
