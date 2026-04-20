import { NextResponse } from "next/server";
import { clearCanvasTokenCookies } from "@/lib/integrations/canvas/auth";

export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  clearCanvasTokenCookies(response);
  return response;
}
