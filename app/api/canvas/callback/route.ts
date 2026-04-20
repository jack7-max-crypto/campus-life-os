import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  clearCanvasOauthStateCookie,
  exchangeCanvasCodeForTokens,
  getCanvasOauthState,
  setCanvasTokenCookies,
} from "@/lib/integrations/canvas/auth";

function buildSettingsRedirect(request: NextRequest, status: string, message?: string) {
  const redirectUrl = new URL("/settings", request.url);
  redirectUrl.searchParams.set("canvas", status);

  if (message) {
    redirectUrl.searchParams.set("message", message);
  }

  return redirectUrl;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const expectedState = getCanvasOauthState(cookieStore);
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      buildSettingsRedirect(request, "error", errorDescription ?? "Canvas access was denied."),
    );
  }

  if (!state || !expectedState || state !== expectedState || !code) {
    return NextResponse.redirect(
      buildSettingsRedirect(request, "error", "Canvas returned an invalid OAuth response."),
    );
  }

  try {
    const tokens = await exchangeCanvasCodeForTokens(code);
    const response = NextResponse.redirect(buildSettingsRedirect(request, "connected"));
    clearCanvasOauthStateCookie(response);
    setCanvasTokenCookies(response, tokens);
    return response;
  } catch {
    return NextResponse.redirect(
      buildSettingsRedirect(request, "error", "Canvas token exchange failed."),
    );
  }
}
