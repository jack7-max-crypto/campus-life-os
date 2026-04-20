import { NextRequest, NextResponse } from "next/server";
import {
  getCanvasAuthorizationUrl,
  setCanvasOauthStateCookie,
} from "@/lib/integrations/canvas/auth";

export async function GET(request: NextRequest) {
  const state = crypto.randomUUID();
  const authorizationUrl = getCanvasAuthorizationUrl(state);

  if (!authorizationUrl) {
    return NextResponse.redirect(new URL("/settings?canvas=setup-required", request.url));
  }

  const response = NextResponse.redirect(authorizationUrl);
  setCanvasOauthStateCookie(response, state);
  return response;
}
